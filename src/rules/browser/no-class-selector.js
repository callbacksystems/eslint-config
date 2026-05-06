// Selecting DOM nodes by CSS class ties behavior to styling and reads state from
// a class that assistive tech never sees, so it is a poor source of truth. Query
// by a `data-*` attribute, `dataset`, or a Stimulus target instead. Flags a class
// token in `querySelector(All)`, `closest`, or `matches`, and every
// `getElementsByClassName` call, whose argument is always a class name.

import { propertyNameOf, stringValuesOf } from "#helpers/ast"
import { reportProblem } from "#helpers/report"

const SELECTOR_METHODS = new Set([ "querySelector", "querySelectorAll", "closest", "matches" ])
const CLASS_TOKEN = /\.[-_a-zA-Z]/

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow selecting DOM nodes by CSS class; classes style, they do not carry state" },
    schema: [],
    messages: {
      noClassSelector:
        "Avoid selecting by CSS class in `{{method}}`. Classes style; use `data-*`, `dataset`, or a Stimulus target."
    }
  },
  create(context) {
    return { CallExpression: (node) => reportProblem(context, new Selection(node)) }
  }
}

class Selection {
  #node

  constructor(node) {
    this.#node = node
  }

  get problem() {
    return this.#isClassLookup
      ? { node: this.#node, messageId: "noClassSelector", data: { method: this.#method } }
      : null
  }

  get #isClassLookup() {
    return this.#method === "getElementsByClassName" || this.#isClassSelectorQuery
  }

  get #method() {
    return this.#node.callee.type === "MemberExpression" ? propertyNameOf(this.#node.callee) : ""
  }

  get #isClassSelectorQuery() {
    return SELECTOR_METHODS.has(this.#method) && this.#selectsByClass
  }

  get #selectsByClass() {
    return stringValuesOf(this.#node.arguments[0]).some((text) => CLASS_TOKEN.test(text))
  }
}
