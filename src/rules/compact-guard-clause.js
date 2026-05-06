// A guard clause whose block wraps a single exit reads better inlined:
// `if (done) return` instead of the three-line block. Collapse it when the
// one-line form still fits the max width; longer ones keep the block.

import { isAnyExit, isSingleLine } from "#helpers/ast"
import { reportProblem } from "#helpers/report"
import { containsComment } from "#helpers/source"

const DEFAULT_MAX_LENGTH = 120

export default {
  meta: {
    type: "layout",
    fixable: "code",
    docs: { description: "Prefer compact single-line guard clauses when they fit on one line" },
    schema: [
      { type: "object", properties: { maxLength: { type: "integer", minimum: 1 } }, additionalProperties: false }
    ],
    messages: { compactGuardClause: "Collapse this single-statement guard clause to a one-line if statement." }
  },
  create(context) {
    const maxLength = context.options[0]?.maxLength ?? DEFAULT_MAX_LENGTH

    return { IfStatement: (node) => reportProblem(context, new GuardClause(node, context.sourceCode, maxLength)) }
  }
}

class GuardClause {
  #node
  #sourceCode
  #maxLength

  constructor(node, sourceCode, maxLength) {
    this.#node = node
    this.#sourceCode = sourceCode
    this.#maxLength = maxLength
  }

  get problem() {
    return this.#isCompactable && this.#node.loc.start.column + this.#compactIf.length <= this.#maxLength
      ? { node: this.#consequent, messageId: "compactGuardClause", fix: (fixer) => this.#fix(fixer) }
      : null
  }

  #fix(fixer) {
    return fixer.replaceTextRange(this.#gapRange, ` ${this.#statementText}`)
  }

  get #isCompactable() {
    return !this.#node.alternate
      && this.#isOneLineSingleExitBlock
      && !containsComment(this.#sourceCode.getText(this.#consequent))
  }

  get #isOneLineSingleExitBlock() {
    return this.#consequent.type === "BlockStatement"
      && this.#consequent.body.length === 1
      && isAnyExit(this.#statement)
      && isSingleLine(this.#statement)
  }

  get #consequent() {
    return this.#node.consequent
  }

  get #statement() {
    return this.#consequent.body[0]
  }

  get #compactIf() {
    return `if (${this.#sourceCode.getText(this.#node.test)}) ${this.#statementText}`
  }

  get #statementText() {
    return this.#sourceCode.getText(this.#statement)
  }

  get #gapRange() {
    return [ this.#sourceCode.getTokenBefore(this.#consequent).range[1], this.#consequent.range[1] ]
  }
}
