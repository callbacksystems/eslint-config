// A memoization that just delegates to another no-argument method (`this.#positions ??= this.#computePositions()`) adds
// a hop for nothing. Inline the computation into the memoization. Calls that take arguments genuinely parameterize, and
// calls on another object are not own delegation; both are left alone.

import { isMemoization, isThisMember } from "#helpers/classes"
import { reportProblem } from "#helpers/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow memoization that delegates to another no-argument private method" },
    schema: [],
    messages: { inlineComputation: "Inline the computation from `{{target}}` instead of delegating." }
  },
  create(context) {
    return { AssignmentExpression: (node) => reportProblem(context, new MemoizedComputation(node)) }
  }
}

class MemoizedComputation {
  #node

  constructor(node) {
    this.#node = node
  }

  get problem() {
    return this.#delegates
      ? { node: this.#node, messageId: "inlineComputation", data: { target: this.#target } }
      : null
  }

  get #delegates() {
    return isMemoization(this.#node) && this.#delegatesToOwnMethod
  }

  get #delegatesToOwnMethod() {
    return this.#computation.type === "CallExpression"
      && this.#computation.arguments.length === 0
      && isPrivateMethodCall(this.#computation.callee)
  }

  get #computation() {
    return this.#node.right
  }

  get #target() {
    return `#${this.#computation.callee.property.name}`
  }
}

function isPrivateMethodCall(callee) {
  return isThisMember(callee) && callee.property.type === "PrivateIdentifier"
}
