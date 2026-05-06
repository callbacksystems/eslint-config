// Stimulus exposes `this.dispatch("name", { detail, prefix, bubbles, cancelable })`
// which fires from `this.element` with the controller identifier as prefix.
// Hand-rolling `this.element.dispatchEvent(new CustomEvent(...))` loses the
// prefix, the convenience, and the consistency. Firing from other elements
// (e.g. a target) is left alone: that is a different intent.

import { enclosingStimulusController, isStringLiteral } from "#helpers/ast"
import { reportProblem } from "#helpers/report"

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
    return { CallExpression: (node) => reportProblem(context, new ElementDispatchCall(node)) }
  }
}

class ElementDispatchCall {
  #node

  constructor(node) {
    this.#node = node
  }

  get problem() {
    return this.#isReportable
      ? { node: this.#node, messageId: "preferDispatch", data: { event: this.#eventLabel } }
      : null
  }

  get #isReportable() {
    return this.#isElementDispatch && enclosingStimulusController(this.#node)
  }

  get #isElementDispatch() {
    const { callee } = this.#node
    return callee.type === "MemberExpression"
      && !callee.computed
      && callee.property.type === "Identifier"
      && callee.property.name === "dispatchEvent"
      && isThisElement(callee.object)
  }

  get #eventLabel() {
    return this.#customEventName ?? "event"
  }

  get #customEventName() {
    const argument = this.#node.arguments[0]
    return isCustomEventConstruction(argument) ? stringLiteralValueOf(argument.arguments[0]) : null
  }
}

function isThisElement(node) {
  return node.type === "MemberExpression"
    && !node.computed
    && node.object.type === "ThisExpression"
    && node.property.type === "Identifier"
    && node.property.name === "element"
}

function isCustomEventConstruction(node) {
  return node?.type === "NewExpression" && node.callee.type === "Identifier" && node.callee.name === "CustomEvent"
}

function stringLiteralValueOf(node) {
  return isStringLiteral(node) ? node.value : null
}
