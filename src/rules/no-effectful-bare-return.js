// A branch that does work and then bails with a bare `return` (`doThing()` then `return`) buries its exit at the
// bottom, past the effect. Lift the guard above the work as an inline `if (cond) return`, invert into `if/else`, or
// extract a helper. A single-statement guard block is collapsed elsewhere, and a function's own trailing bare return is
// handled by its own rule, so this targets the multi-statement branch that ends in a lone return.

import { isBareReturn } from "#helpers/functions"
import { reportProblems } from "#helpers/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow a bare `return` at the end of a branch that first does other work" },
    schema: [],
    messages: {
      effectfulBareReturn:
        "Don't do work then `return`. Lift the exit to an inline guard, invert into if/else, or extract a helper."
    }
  },
  create(context) {
    return { IfStatement: (node) => reportProblems(context, new Branches(node)) }
  }
}

class Branches {
  #node

  constructor(node) {
    this.#node = node
  }

  get problems() {
    return [ this.#node.consequent, this.#node.alternate ]
      .map((branch) => trailingBareReturnOf(branch))
      .filter(Boolean)
      .map((statement) => ({ node: statement, messageId: "effectfulBareReturn" }))
  }
}

function trailingBareReturnOf(branch) {
  if (branch?.type !== "BlockStatement" || branch.body.length < 2) return null

  const last = branch.body.at(-1)
  return isBareReturn(last) ? last : null
}
