// A blank line after a guard clause sets the early exits apart from the work
// that follows, so a method reads as "preconditions, then the real body".
// Required only between a guard and the next non-guard statement.

import { isAnyExit, isGuardClause } from "#helpers/ast"
import { reportProblem } from "#helpers/report"

export default {
  meta: {
    type: "layout",
    fixable: "whitespace",
    docs: { description: "Require a blank line after guard clauses" },
    schema: [],
    messages: { expectedBlankLine: "Expected a blank line after this guard clause." }
  },
  create(context) {
    function verifyBody(body) {
      body.slice(0, -1).forEach((current, index) =>
        reportProblem(context, new GuardPair(context.sourceCode, current, body[index + 1])))
    }

    return {
      Program(node) {
        verifyBody(node.body)
      },
      BlockStatement(node) {
        verifyBody(node.body)
      },
      SwitchCase(node) {
        verifyBody(node.consequent)
      }
    }
  }
}

class GuardPair {
  #sourceCode
  #current
  #next

  constructor(sourceCode, current, next) {
    this.#sourceCode = sourceCode
    this.#current = current
    this.#next = next
  }

  get problem() {
    const insertAfter = this.#insertAfter
    return insertAfter
      ? { node: this.#next, messageId: "expectedBlankLine", fix: (fixer) => fixer.insertTextAfter(insertAfter, "\n") }
      : null
  }

  #isAdjacent(last) {
    const first = this.#sourceCode.getFirstToken(this.#next, { includeComments: true })
    return last && first && first.loc.start.line - last.loc.end.line < 2
  }

  get #insertAfter() {
    if (!isLoopAwareGuard(this.#current) || isExitOrGuardClause(this.#next)) return null

    const last = this.#sourceCode.getLastToken(this.#current)
    return this.#isAdjacent(last) ? last : null
  }
}

// Treat both function exits and loop control as guards; the blank-line cue
// helps equally in either context.
function isLoopAwareGuard(node) {
  return isGuardClause(node, isAnyExit)
}

function isExitOrGuardClause(node) {
  return isLoopAwareGuard(node) || isAnyExit(node)
}
