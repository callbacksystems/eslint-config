// A `for...of` that conditionally returns a value is a search written long-hand:
// `array.find((x) => condition)` (or `.some()`) says it declaratively. The signal
// is a `return <value>` guarded by an `if` inside the loop's own body. `prefer-for-each`
// deliberately leaves these alone (a `forEach` callback cannot return out of the
// function), so this rule points them at `find`/`some` instead.

import { sharesFunction, walk } from "#helpers/ast"
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
    return Array.from(walk(this.#node.body)).some((descendant) => isOwnValueReturn(descendant, this.#node))
  }
}

// A `return <value>` reached only through an `if`, belonging to the loop itself: an
// escape in a nested function belongs to that function, so it does not count.
function isOwnValueReturn(node, loop) {
  return node.type === "ReturnStatement"
    && Boolean(node.argument)
    && sharesFunction(node, loop)
    && isUnderIf(node, loop)
}

function isUnderIf(node, loop) {
  for (let current = node.parent; current && current !== loop; current = current.parent) {
    if (current.type === "IfStatement") return true
  }
  return false
}
