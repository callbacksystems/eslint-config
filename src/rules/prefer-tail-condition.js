// `if (condition) return; return X` reads as a doubled-up negation. Inverting to `if (!condition) return X` says the
// same thing positively in one statement. JS's implicit `undefined` return covers the falsy case naturally.
//
// Only in tail position: the rewrite drops the `return`, so falling out of the block has to be the same thing as
// leaving the function. Inside a loop body or a block with statements after it, dropping the `return` would let
// execution continue where the original bailed out.

import { innerStatementOf, isBareReturn, isFunction, isIfWithoutAlternate, isReturnWithValue } from "#helpers/functions"
import { holdsComment, negated } from "#helpers/source"
import { reportProblem } from "#helpers/report"

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: {
      description: "Prefer `if (!condition) return X` over `if (condition) return; return X` at the tail of a block"
    },
    schema: [],
    messages: { preferTailCondition: "Use `if (!condition) return X` instead of `if (condition) return; return X`." }
  },
  create(context) {
    return { BlockStatement: (node) => reportProblem(context, new TailBlock(node, context.sourceCode)) }
  }
}

class TailBlock {
  #block
  #sourceCode

  constructor(block, sourceCode) {
    this.#block = block
    this.#sourceCode = sourceCode
  }

  get problem() {
    return this.#isReportable ? { node: this.#ifStatement, messageId: "preferTailCondition", fix: this.#fix } : null
  }

  get #isReportable() {
    return this.#block.body.length >= 2
      && isReturnWithValue(this.#lastReturn)
      && isIfBareReturn(this.#ifStatement)
      && this.#endsTheFunction
  }

  get #lastReturn() {
    return this.#block.body.at(-1)
  }

  get #ifStatement() {
    return this.#block.body.at(-2)
  }

  // Whether running off the end of this block leaves the enclosing function: it is the function body, or the last
  // statement of a chain of blocks and `if`s that is itself in tail position. A loop, `try`, `switch`, or label in the
  // chain can resume execution elsewhere, so the walk stops there.
  get #endsTheFunction() {
    for (let node = this.#block; node.parent; node = node.parent) {
      if (isFunction(node.parent)) return node.parent.body === node
      if (!fallsThroughToParent(node.parent, node)) return false
    }
    return false
  }

  // The two statements merge into one, so a comment written between them has nowhere to go: the offense stands, the fix
  // does not.
  get #fix() {
    return holdsComment(this.#sourceCode, this.#range) ? null : this.#replacer
  }

  get #range() {
    return [ this.#ifStatement.range[0], this.#lastReturn.range[1] ]
  }

  get #replacer() {
    return (fixer) => fixer.replaceTextRange(this.#range, this.#replacement)
  }

  get #replacement() {
    return `if (${negated(this.#sourceCode, this.#ifStatement.test)}) return ${this.#returnedText}`
  }

  get #returnedText() {
    return this.#sourceCode.getText(this.#lastReturn.argument)
  }
}

function isIfBareReturn(node) {
  return isIfWithoutAlternate(node) && isBareReturn(innerStatementOf(node.consequent))
}

function fallsThroughToParent(parent, node) {
  return parent.type === "BlockStatement" ? parent.body.at(-1) === node : isIfBranch(parent, node)
}

function isIfBranch(parent, node) {
  return parent.type === "IfStatement" && (parent.consequent === node || parent.alternate === node)
}
