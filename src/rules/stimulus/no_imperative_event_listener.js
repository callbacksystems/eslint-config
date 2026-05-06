// Stimulus owns event registration: wire actions via `data-action` in HTML so readers see what happens where it
// happens, and so Stimulus tears the listener down on `disconnect()`. Action options say everything the options object
// would (`:once`, `:passive`, `:!passive`, `:capture`, `:prevent`, `:stop`, `:self`), and `@window`/`@document` reach
// the globals, so while the controller wires itself up no option earns an exception.
// Two things narrow the rule. Only receivers `data-action` can reach are checked, which leaves a listener on
// `matchMedia(...)` or `visualViewport` alone. And a listener registered mid-flow is tied to an operation no descriptor
// can scope, so there it only has to clean up after itself through `once` or a `signal`.

import { resolvedMemberKeyOf, resolvedPublicMemberNameOf } from "#helpers/classes/resolved_member_key"
import { isStringLiteral } from "#helpers/syntax/ast"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { NearestAncestor } from "#helpers/syntax/nearest_ancestor"
import { UndefinedValueResolver } from "#helpers/flow/undefined_value_resolver"
import {
  enclosingStimulusController, isControllerInstanceContext, isControllerInstanceThis
} from "#helpers/classes/stimulus"
import { reportProblem } from "#helpers/eslint/report"

const WIRING_NAMES = new Set([ "initialize", "connect" ])
const CONNECTED_SUFFIXES = [ "TargetConnected", "OutletConnected" ]
const TEARDOWN_OPTIONS = new Set([ "once", "signal" ])
const TARGET_PROPERTY = /^[a-z][a-zA-Z0-9]*Targets?$/u
const GLOBAL_RECEIVERS = new Set([ "window", "document" ])
const METHOD_BOUNDARIES = new Set(
  [ "ArrowFunctionExpression", "ClassBody", "FunctionDeclaration", "FunctionExpression" ]
)
const EXECUTION_BOUNDARIES = new Set([ "ClassBody", "FunctionDeclaration", "FunctionExpression", "StaticBlock" ])

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
    const bindings = new BindingResolver(context.sourceCode)
    const services = { bindings, scopes: new ListenerScopes(), signals: new UndefinedValueResolver(bindings) }
    return { CallExpression: (node) => reportProblem(context, new ListenerCall(node, services)) }
  }
}

class ListenerScopes {
  #executionBoundaries = new NearestAncestor(isExecutionBoundary)
  #methodBoundaries = new NearestAncestor(isMethodBoundary)

  isControllerInstanceContext(node, controller) {
    const boundary = this.#executionBoundaries.above(node)
    return boundary?.type === "ClassBody"
      ? isControllerInstanceContext(node, controller)
      : new ControllerFunction(boundary, controller).isMember
  }

  methodDefinitionAround(node, controller) {
    return new ControllerFunction(this.#methodBoundaries.above(node), controller).methodDefinition
  }
}

function isExecutionBoundary(node) {
  return EXECUTION_BOUNDARIES.has(node.type)
}

function isMethodBoundary(node) {
  return METHOD_BOUNDARIES.has(node.type)
}

class ControllerFunction {
  #controller
  #definition
  #node

  constructor(node, controller) {
    this.#controller = controller
    this.#definition = node?.type === "FunctionExpression" ? node.parent : null
    this.#node = node
  }

  get isMember() {
    return this.#belongsToController && (this.#isMethod || this.#isFieldValue)
  }

  get methodDefinition() {
    return this.#belongsToController && this.#isMethod ? this.#definition : null
  }

  get #belongsToController() {
    return Boolean(this.#controller) && this.#definition?.parent === this.#controller.body
      && !this.#definition.static
  }

  get #isMethod() {
    return this.#definition?.type === "MethodDefinition"
  }

  get #isFieldValue() {
    return this.#definition?.type === "PropertyDefinition" && this.#definition.value === this.#node
  }
}

class ListenerCall {
  #node
  #bindings
  #scopes
  #signals
  #cachedMethod
  #cachedController

  constructor(node, { bindings, scopes, signals }) {
    this.#node = node
    this.#bindings = bindings
    this.#scopes = scopes
    this.#signals = signals
  }

  get problem() {
    return this.#isReportable
      ? { node: this.#node, messageId: this.#messageId, data: { event: this.#eventLabel } }
      : null
  }

  get #isReportable() {
    return this.#isReachableListener && !this.#isExcused
  }

  get #isReachableListener() {
    return this.#isControllerListener && this.#receiver.isReachableByAction
  }

  get #isControllerListener() {
    return this.#isAddEventListener && this.#scopes.isControllerInstanceContext(this.#node, this.#controller)
  }

  get #isAddEventListener() {
    return this.#callee.type === "MemberExpression" && this.#hasPublicCalleeName("addEventListener")
  }

  get #callee() {
    return this.#node.callee
  }

  #hasPublicCalleeName(name) {
    return resolvedPublicMemberNameOf(this.#callee, this.#bindings) === name
  }

  get #controller() {
    return this.#cachedController ??= enclosingStimulusController(this.#node)
  }

  get #receiver() {
    return new Receiver(this.#callee.object, {
      method: this.#method,
      controller: this.#controller,
      bindings: this.#bindings
    })
  }

  get #method() {
    return this.#cachedMethod ??= new EnclosingMethod(this.#node, {
      bindings: this.#bindings,
      controller: this.#controller,
      scopes: this.#scopes
    })
  }

  get #isExcused() {
    return !this.#method.isWiring && this.#hasTeardownOption
  }

  get #hasTeardownOption() {
    const options = this.#node.arguments[2]
    return options?.type === "ObjectExpression"
      && options.properties.some((property) => new TeardownOption(property, {
        bindings: this.#bindings, signals: this.#signals
      }).isPresent)
  }

  get #messageId() {
    return this.#method.isWiring ? "wireInHtml" : "unscopedListener"
  }

  get #eventLabel() {
    const [ first ] = this.#node.arguments
    return isStringLiteral(first) ? first.value : "event"
  }
}

// Anything a `data-action` descriptor could not name (a media query list, a viewport) is out of the rule's reach.
class Receiver {
  #node
  #method
  #controller
  #bindings

  constructor(node, { method, controller, bindings }) {
    this.#node = node
    this.#method = method
    this.#controller = controller
    this.#bindings = bindings
  }

  get isReachableByAction() {
    return this.#isGlobal || this.#isControllerProperty || this.#isConnectedElement
  }

  get #isGlobal() {
    return this.#isGlobalName && this.#bindings.isUnmodifiedGlobal(this.#element)
  }

  get #isGlobalName() {
    return this.#element.type === "Identifier" && GLOBAL_RECEIVERS.has(this.#element.name)
  }

  // `this.fooTargets[0]` names the same element the collection does.
  get #element() {
    return this.#isIndexedTarget ? this.#node.object : this.#node
  }

  get #isIndexedTarget() {
    return this.#node.type === "MemberExpression"
      && this.#node.computed
      && this.#node.object.type === "MemberExpression"
      && resolvedPublicMemberNameOf(this.#node.object, this.#bindings)?.endsWith("Targets")
  }

  get #isControllerProperty() {
    return this.#isControllerElement || this.#isTarget
  }

  get #isControllerElement() {
    return this.#property === "element" && isControllerInstanceThis(this.#element.object, this.#controller)
  }

  get #property() {
    const isThisProperty = this.#element.type === "MemberExpression"
      && this.#element.object.type === "ThisExpression"
    return isThisProperty ? resolvedPublicMemberNameOf(this.#element, this.#bindings) : null
  }

  get #isTarget() {
    return this.#isTargetProperty && isControllerInstanceThis(this.#element.object, this.#controller)
  }

  get #isTargetProperty() {
    return Boolean(this.#property) && TARGET_PROPERTY.test(this.#property)
  }

  get #isConnectedElement() {
    return this.#element.type === "Identifier" && this.#matchesElementParameter
  }

  get #matchesElementParameter() {
    return Boolean(this.#method.elementParameter)
      && this.#bindings.sharesBinding(this.#element, this.#method.elementParameter)
  }
}

class EnclosingMethod {
  #node
  #bindings
  #controller
  #scopes
  #cachedDefinition

  constructor(node, { bindings, controller, scopes }) {
    this.#node = node
    this.#bindings = bindings
    this.#controller = controller
    this.#scopes = scopes
  }

  get isWiring() {
    return WIRING_NAMES.has(this.#name) || this.#isConnectedCallback
  }

  // A `*TargetConnected` or `*OutletConnected` callback receives a target like any other.
  get elementParameter() {
    if (this.#isConnectedCallback) {
      const parameter = this.#definition.value.params[this.#elementParameterIndex]
      return parameter?.type === "Identifier" ? parameter : null
    } else {
      return null
    }
  }

  get #name() {
    return this.#definition ? resolvedMemberKeyOf(this.#definition, this.#bindings)?.name ?? null : null
  }

  get #definition() {
    return this.#cachedDefinition ??= this.#scopes.methodDefinitionAround(this.#node, this.#controller)
  }

  get #isConnectedCallback() {
    return CONNECTED_SUFFIXES.some((suffix) => this.#name?.endsWith(suffix) && this.#name !== suffix)
  }

  get #elementParameterIndex() {
    return this.#name.endsWith("OutletConnected") ? 1 : 0
  }
}

class TeardownOption {
  #property
  #bindings
  #signals
  #cachedKey

  constructor(property, { bindings, signals }) {
    this.#property = property
    this.#bindings = bindings
    this.#signals = signals
  }

  get isPresent() {
    return this.#hasSupportedName && this.#hasTeardownValue
  }

  get #hasSupportedName() {
    return this.#hasStaticName && TEARDOWN_OPTIONS.has(this.#name)
  }

  get #hasStaticName() {
    return this.#property.type === "Property" && Boolean(this.#key)
  }

  get #key() {
    return this.#cachedKey ??= resolvedMemberKeyOf(this.#property, this.#bindings)
  }

  get #name() {
    return this.#key.name
  }

  get #hasTeardownValue() {
    return this.#name === "once" ? this.#isLiteralTrue : this.#isPresentSignal
  }

  get #isLiteralTrue() {
    return this.#property.value.type === "Literal" && this.#property.value.value === true
  }

  get #isPresentSignal() {
    const { value } = this.#property
    return value.type === "Identifier"
      ? !this.#signals.isDefinitelyUndefined(value)
      : isSignalExpression(value)
  }
}

function isSignalExpression(node) {
  return node.type === "MemberExpression" || node.type === "CallExpression"
}
