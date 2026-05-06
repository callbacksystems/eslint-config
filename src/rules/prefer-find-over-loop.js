// A `for...of` that conditionally returns a value is a search written long-hand: `array.find((x) => condition)` (or
// `.some()`) says it declaratively. The signal is a `return <value>` guarded by an `if` inside the loop's own body.
// `prefer-for-each` deliberately leaves these alone (a `forEach` callback cannot return out of the function), so this
// rule points them at `find`/`some` instead.

import { walk } from "#helpers/ast"
import { sharesFunction } from "#helpers/functions"
import { reportProblem } from "#helpers/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer `.find()`/`.some()` over a `for...of` that conditionally returns a value" },
    schema: [],
    messages: { preferFind: "This `for...of` conditionally returns a value. Prefer `.find()` or `.some()`." }
  },
  create(context) {
    return { ForOfStatement: (node) => reportProblem(context, new SearchLoop(node)) }
  }
}

class SearchLoop {
  #node

  constructor(node) {
    this.#node = node
  }

  get problem() {
    return this.#isSearch ? { node: this.#node, messageId: "preferFind" } : null
  }

  get #isSearch() {
    return !this.#node.await && this.#hasConditionalValueReturn
  }

  get #hasConditionalValueReturn() {
    return Array.from(walk(this.#node.body)).some((descendant) => new Descendant(descendant, this.#node).isValueReturn)
  }
}

class Descendant {
  #node
  #loop

  constructor(node, loop) {
    this.#node = node
    this.#loop = loop
  }

  // An escape in a nested function belongs to that function.
  get isValueReturn() {
    return this.#node.type === "ReturnStatement"
      && Boolean(this.#node.argument)
      && sharesFunction(this.#node, this.#loop)
      && this.#isUnderIf
  }

  get #isUnderIf() {
    for (let current = this.#node.parent; current && current !== this.#loop; current = current.parent) {
      if (current.type === "IfStatement") return true
    }
    return false
  }
}
