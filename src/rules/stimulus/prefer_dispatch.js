// Stimulus exposes `this.dispatch("name", { detail, prefix, bubbles, cancelable })` which fires from `this.element`
// with the controller identifier as prefix. Hand-rolling `this.element.dispatchEvent(new CustomEvent(...))` loses the
// prefix, the convenience, and the consistency. Firing from other elements (e.g. a target) is left alone: that is a
// different intent.

import { isStringLiteral } from "#helpers/syntax/ast"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"
import { resolvedPublicMemberNameOf } from "#helpers/classes/resolved_member_key"
import { enclosingStimulusController, isControllerInstanceThis } from "#helpers/classes/stimulus"
import { reportProblem } from "#helpers/eslint/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer `this.dispatch(...)` over `this.element.dispatchEvent(...)` in Stimulus controllers" },
    schema: [],
    messages: {
      preferDispatch:
        "Use `this.dispatch(\"{{event}}\", { detail })` instead of `this.element.dispatchEvent`. "
        + "Stimulus prefixes the event with the controller identifier."
    }
  },
  create(context) {
    const bindings = BindingResolver.for(context.sourceCode)
    const globals = new GlobalValueIdentity(bindings)
    return { CallExpression: (node) => reportProblem(context, new ElementDispatchCall(node, { bindings, globals })) }
  }
}

class ElementDispatchCall {
  #node
  #bindings
  #globals

  constructor(node, { bindings, globals }) {
    this.#node = node
    this.#bindings = bindings
    this.#globals = globals
  }

  get problem() {
    return this.#isReportable
      ? { node: this.#node, messageId: "preferDispatch", data: { event: this.#eventLabel } }
      : null
  }

  get #isReportable() {
    return this.#isElementDispatch
      && this.#isCustomEvent
      && this.#isReturnValueDiscarded
      && isControllerInstanceThis(this.#this, enclosingStimulusController(this.#node))
  }

  get #isElementDispatch() {
    const { callee } = this.#node
    return !this.#node.optional
      && callee.type === "MemberExpression"
      && !callee.optional
      && resolvedPublicMemberNameOf(callee, this.#bindings) === "dispatchEvent"
      && this.#isThisElement(callee.object)
  }

  #isThisElement(node) {
    return node.type === "MemberExpression"
      && !node.optional
      && node.object.type === "ThisExpression"
      && resolvedPublicMemberNameOf(node, this.#bindings) === "element"
  }

  get #isCustomEvent() {
    const event = this.#event
    return event?.type === "NewExpression"
      && this.#globals.matches(event.callee, "CustomEvent")
  }

  get #event() {
    const event = this.#node.arguments[0]
    return event?.type === "Identifier" ? this.#bindings.stableValueFor(event) : event
  }

  get #isReturnValueDiscarded() {
    return this.#node.parent.type === "ExpressionStatement"
  }

  get #this() {
    return this.#node.callee.object.object
  }

  get #eventLabel() {
    return this.#customEventName ?? "event"
  }

  get #customEventName() {
    return stringLiteralValueOf(this.#event.arguments[0])
  }
}

function stringLiteralValueOf(node) {
  return isStringLiteral(node) ? node.value : null
}
