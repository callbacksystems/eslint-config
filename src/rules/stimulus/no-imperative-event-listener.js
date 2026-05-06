// Stimulus owns event registration: wire actions via `data-action` in HTML so
// readers see what happens where it happens, and so Stimulus tears the listener
// down on `disconnect()`. Allowed only for cases `data-action` cannot express:
// `{ once: true }`, an explicit `signal`, or a `passive: <literal>` option.
// `@window`/`@document`/`:capture`/`:prevent`/`:stop` cover the rest.

import { enclosingStimulusController, isStringLiteral } from "#helpers/ast"
import { reportProblem } from "#helpers/report"

const PERMITTED_OPTIONS = new Set([ "once", "signal", "passive" ])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow `addEventListener` in Stimulus controllers; use `data-action` in HTML" },
    schema: [],
    messages: {
      imperativeListener:
        "Wire this listener via `data-action=\"{{event}}->controller#method\"` in HTML, not `addEventListener`. "
        + "If the binding repeats across elements, extract a partial/helper so the data-action lives in one place."
    }
  },
  create(context) {
    return { CallExpression: (node) => reportProblem(context, new ListenerCall(node)) }
  }
}

class ListenerCall {
  #node

  constructor(node) {
    this.#node = node
  }

  get problem() {
    return this.#isReportable
      ? { node: this.#node, messageId: "imperativeListener", data: { event: this.#eventLabel } }
      : null
  }

  get #isReportable() {
    return this.#isAddEventListener && !this.#hasPermittedOption && enclosingStimulusController(this.#node)
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

  get #hasPermittedOption() {
    const options = this.#node.arguments[2]
    return options?.type === "ObjectExpression" && options.properties.some(isPermittedProperty)
  }

  get #eventLabel() {
    const first = this.#node.arguments[0]
    return isStringLiteral(first) ? first.value : "event"
  }
}

function isPermittedProperty(property) {
  return property.type === "Property"
    && property.key.type === "Identifier"
    && PERMITTED_OPTIONS.has(property.key.name)
}
