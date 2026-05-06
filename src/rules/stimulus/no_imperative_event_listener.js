// Stimulus owns event registration: wire actions via `data-action` in HTML so readers see what happens where it
// happens, and so Stimulus tears the listener down on `disconnect()`. Action options say everything the options object
// would (`:once`, `:passive`, `:!passive`, `:capture`, `:prevent`, `:stop`, `:self`), and `@window`/`@document` reach
// the globals, so while the controller wires itself up no option earns an exception.
// Two things narrow the rule. Only receivers `data-action` can reach are checked, which leaves a listener on
// `matchMedia(...)` or `visualViewport` alone. And a listener registered mid-flow is tied to an operation no descriptor
// can scope, so there it only has to clean up after itself through `once` or a `signal`.

import { keyName } from "#helpers/classes"
import { isStringLiteral } from "#helpers/ast"
import { enclosingStimulusController } from "#helpers/stimulus"
import { reportProblem } from "#helpers/report"

const WIRING_NAMES = new Set([ "initialize", "connect" ])
const CONNECTED_SUFFIXES = [ "TargetConnected", "OutletConnected" ]
const TEARDOWN_OPTIONS = new Set([ "once", "signal" ])
const TARGET_PROPERTY = /^[a-z][a-zA-Z0-9]*Targets?$/u
const GLOBAL_RECEIVERS = new Set([ "window", "document" ])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow `addEventListener` in Stimulus controllers; use `data-action` in HTML" },
    schema: [],
    messages: {
      wireInHtml:
        "Wire this listener via `data-action=\"{{event}}->controller#method\"` in HTML, not `addEventListener`. "
        + "Action options such as `:once`, `:passive` and `:capture` say what the options object says.",
      unscopedListener:
        "This listener outlives the operation that registered it. Scope it with `{ once: true }` or an "
        + "`AbortController` signal, or wire it via `data-action=\"{{event}}->controller#method\"` in HTML."
    }
  },
  create(context) {
    return { CallExpression: (node) => reportProblem(context, new ListenerCall(node)) }
  }
}

class ListenerCall {
  #node
  #cachedMethod

  constructor(node) {
    this.#node = node
  }

  get problem() {
    return this.#isReportable
      ? { node: this.#node, messageId: this.#messageId, data: { event: this.#eventLabel } }
      : null
  }

  get #isReportable() {
    return this.#isAddEventListener
      && Boolean(enclosingStimulusController(this.#node))
      && this.#receiver.isReachableByAction
      && !this.#isExcused
  }

  get #isAddEventListener() {
    return this.#callee.type === "MemberExpression"
      && !this.#callee.computed
      && this.#callee.property.type === "Identifier"
      && this.#callee.property.name === "addEventListener"
  }

  get #callee() {
    return this.#node.callee
  }

  get #receiver() {
    return new Receiver(this.#callee.object, this.#method)
  }

  get #method() {
    return this.#cachedMethod ??= new EnclosingMethod(this.#node)
  }

  get #isExcused() {
    return !this.#method.isWiring && this.#hasTeardownOption
  }

  get #hasTeardownOption() {
    const options = this.#node.arguments[2]
    return options?.type === "ObjectExpression" && options.properties.some(isTeardownProperty)
  }

  get #messageId() {
    return this.#method.isWiring ? "wireInHtml" : "unscopedListener"
  }

  get #eventLabel() {
    const [ first ] = this.#node.arguments
    return isStringLiteral(first) ? first.value : "event"
  }
}

// An element a `data-action` descriptor could name. Anything else is out of the rule's reach, whether it is a media
// query list, a viewport, or an element the controller was handed from elsewhere.
class Receiver {
  #node
  #method

  constructor(node, method) {
    this.#node = node
    this.#method = method
  }

  get isReachableByAction() {
    return this.#isGlobal || this.#isControllerElement || this.#isTarget || this.#isConnectedElement
  }

  get #isGlobal() {
    return this.#element.type === "Identifier" && GLOBAL_RECEIVERS.has(this.#element.name)
  }

  // `this.fooTargets[0]` names the same element the collection does.
  get #element() {
    const isIndexed = this.#node.type === "MemberExpression" && this.#node.computed
    return isIndexed ? this.#node.object : this.#node
  }

  get #isControllerElement() {
    return this.#property === "element"
  }

  get #property() {
    const isThisProperty = this.#element.type === "MemberExpression"
      && !this.#element.computed
      && this.#element.object.type === "ThisExpression"
    return isThisProperty ? keyName(this.#element.property) : null
  }

  get #isTarget() {
    return Boolean(this.#property) && TARGET_PROPERTY.test(this.#property)
  }

  get #isConnectedElement() {
    return this.#element.type === "Identifier" && this.#element.name === this.#method.elementParameter
  }
}

class EnclosingMethod {
  #node
  #cachedDefinition

  constructor(node) {
    this.#node = node
  }

  get isWiring() {
    return WIRING_NAMES.has(this.#name) || this.#isConnectedCallback
  }

  // The element a `*TargetConnected` or `*OutletConnected` callback receives, which is a target like any other.
  get elementParameter() {
    if (this.#isConnectedCallback) {
      const [ first ] = this.#definition.value.params
      return first?.type === "Identifier" ? first.name : null
    } else {
      return null
    }
  }

  get #name() {
    return this.#definition ? keyName(this.#definition.key) : null
  }

  get #definition() {
    return this.#cachedDefinition ??= definitionAround(this.#node)
  }

  get #isConnectedCallback() {
    return CONNECTED_SUFFIXES.some((suffix) => this.#name?.endsWith(suffix) && this.#name !== suffix)
  }
}

function definitionAround(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === "MethodDefinition") return current
  }
  return null
}

function isTeardownProperty(property) {
  return property.type === "Property"
    && property.key.type === "Identifier"
    && TEARDOWN_OPTIONS.has(property.key.name)
}
