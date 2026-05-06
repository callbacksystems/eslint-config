import { isAnyExit, isGuardClause } from "#rules/helpers"

// Treat both function exits and loop control as guards; the blank-line cue
// helps equally in either context.
const isLoopAwareGuard = (node) => isGuardClause(node, isAnyExit)

const isExitOrGuardClause = (node) => isLoopAwareGuard(node) || isAnyExit(node)

const isAdjacent = (last, first) =>
  last && first && first.loc.start.line - last.loc.end.line < 2

const needsBlankLine = (sourceCode, current, next) => {
  if (!isLoopAwareGuard(current) || isExitOrGuardClause(next)) return

  const last = sourceCode.getLastToken(current)
  const first = sourceCode.getFirstToken(next, { includeComments: true })
  if (isAdjacent(last, first)) return last
}

export default {
  meta: {
    type: "layout",
    fixable: "whitespace",
    docs: {
      description: "Require a blank line after guard clauses"
    },
    schema: [],
    messages: {
      expectedBlankLine: "Expected a blank line after this guard clause."
    }
  },
  create(context) {
    const { sourceCode } = context

    const verifyBody = (body) => {
      for (let index = 0; index < body.length - 1; index += 1) {
        const current = body[index]
        const next = body[index + 1]
        const insertAfter = needsBlankLine(sourceCode, current, next)
        if (insertAfter) {
          context.report({
            node: next,
            messageId: "expectedBlankLine",
            fix: (fixer) => fixer.insertTextAfter(insertAfter, "\n")
          })
        }
      }
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
