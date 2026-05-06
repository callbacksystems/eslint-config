// `if (condition) return; return X` reads as a doubled-up negation. Inverting to `if (!condition) return X` says the
// same thing positively in one statement. JS's implicit `undefined` return covers the falsy case naturally.
//
// Only in tail position: the rewrite drops the `return`, so falling out of the block has to be the same thing as
// leaving the function. Inside a loop body or a block with statements after it, dropping the `return` would let
// execution continue where the original bailed out.

import {
  innerStatementOf, isBareReturn, isFunction, isIfWithoutAlternate, isReturnWithValue
} from "#helpers/syntax/functions"
import { hasToolDirectiveIn } from "#helpers/source/comment_directives"
import {
  commentPreservingReplacementFix, commentsIn, conditionSource, hasCommentBeforeCondition, lineEndingOf, negated,
  nestedCommentText, returnValueSource
} from "#helpers/source/source"
import { isWithin } from "#helpers/syntax/ranges"
import { reportProblem } from "#helpers/eslint/report"

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
  #cachedCondition
  #cachedGuardComments
  #cachedReturnComments
  #cachedLineEnding
  #cachedReturnValue

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

  // Whether running off the end of this block leaves the enclosing function, walking up through blocks and `if`s. A
  // loop, `try`, `switch`, or label can resume execution elsewhere, so the walk stops there.
  get #endsTheFunction() {
    for (let node = this.#block; !isFunction(node.parent); node = node.parent) {
      if (!new AncestryStep(node.parent, node).fallsThrough) return false
    }
    return true
  }

  // The two statements merge into one, and a comment written between them stands above it or trails it.
  get #fix() {
    return this.#isFixable ? this.#fixer : null
  }

  get #isFixable() {
    return !hasCommentBeforeCondition(this.#sourceCode, this.#ifStatement) && !this.#hasToolDirective
  }

  get #hasToolDirective() {
    return hasToolDirectiveIn({ sourceCode: this.#sourceCode, node: this.#ifStatement, range: this.#range })
  }

  get #range() {
    return [ this.#ifStatement.range[0], this.#returnEnd ]
  }

  get #returnEnd() {
    return this.#returnComments.at(-1)?.range[1] ?? this.#lastReturn.range[1]
  }

  get #returnComments() {
    return this.#cachedReturnComments ??= commentsIn(
      this.#sourceCode,
      [ this.#lastReturn.range[1], this.#block.range[1] ]
    ).filter((comment) => comment.loc.start.line === this.#lastReturn.loc.end.line)
  }

  get #fixer() {
    return commentPreservingReplacementFix(this.#sourceCode, this.#range, {
      text: this.#replacement,
      preserving: [ this.#condition, this.#returnValue, ...this.#guardComments, ...this.#returnComments ]
    })
  }

  get #replacement() {
    return [
      `if (${this.#negatedCondition}) return ${this.#returnedText}`,
      this.#returnCommentText,
      this.#guardAlternate
    ].join("")
  }

  get #negatedCondition() {
    return negated(this.#sourceCode, this.#ifStatement.test, { text: this.#condition.text })
  }

  get #condition() {
    return this.#cachedCondition ??= conditionSource(this.#sourceCode, this.#ifStatement)
  }

  get #returnedText() {
    return this.#returnValue.text
  }

  get #returnValue() {
    return this.#cachedReturnValue ??= returnValueSource(this.#sourceCode, this.#lastReturn)
  }

  get #returnCommentText() {
    return this.#returnComments.map((comment) => ` ${this.#sourceCode.getText(comment)}`).join("")
  }

  get #guardAlternate() {
    return this.#guardComments.length > 0
      ? `${this.#lineEnding}${this.#indent}else {${this.#lineEnding}${this.#guardCommentText}`
      + `${this.#indent}  return${this.#lineEnding}${this.#indent}}`
      : ""
  }

  get #guardComments() {
    return this.#cachedGuardComments ??= commentsIn(
      this.#sourceCode,
      [ this.#ifStatement.range[0], this.#lastReturn.range[0] ]
    ).filter((comment) => !isWithin(comment, this.#condition.range) && this.#belongsToGuard(comment))
  }

  #belongsToGuard(comment) {
    return comment.range[1] <= this.#ifStatement.range[1]
      || comment.loc.start.line === this.#ifStatement.loc.end.line
  }

  get #lineEnding() {
    return this.#cachedLineEnding ??= lineEndingOf(this.#sourceCode)
  }

  get #indent() {
    return " ".repeat(this.#ifStatement.loc.start.column)
  }

  get #guardCommentText() {
    return nestedCommentText(this.#guardComments, {
      sourceCode: this.#sourceCode, indent: this.#indent, lineEnding: this.#lineEnding
    })
  }
}

function isIfBareReturn(node) {
  return isIfWithoutAlternate(node) && isBareReturn(innerStatementOf(node.consequent))
}

class AncestryStep {
  #parent
  #node

  constructor(parent, node) {
    this.#parent = parent
    this.#node = node
  }

  get fallsThrough() {
    return this.#parent.type === "BlockStatement"
      ? this.#parent.body.at(-1) === this.#node
      : this.#isIfBranch || this.#isTryBody || this.#parent.type === "CatchClause"
  }

  get #isIfBranch() {
    return this.#parent.type === "IfStatement"
      && (this.#parent.consequent === this.#node || this.#parent.alternate === this.#node)
  }

  get #isTryBody() {
    return this.#parent.type === "TryStatement" && this.#node !== this.#parent.finalizer
  }
}
