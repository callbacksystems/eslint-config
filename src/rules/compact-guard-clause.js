import { isAnyExit } from "#rules/helpers"

const containsComment = (text) => text.includes("//") || text.includes("/*")

const isOneLineSingleExitBlock = (consequent) => {
  if (consequent.type !== "BlockStatement" || consequent.body.length !== 1) return false

  const [ statement ] = consequent.body
  return isAnyExit(statement) && statement.loc.start.line === statement.loc.end.line
}

const isCompactableGuard = (node, sourceCode) =>
  !node.alternate
  && isOneLineSingleExitBlock(node.consequent)
  && !containsComment(sourceCode.getText(node.consequent))

const buildCompactReplacement = (node, sourceCode) => {
  const [ statement ] = node.consequent.body
  const statementText = sourceCode.getText(statement)
  const compactIf = `if (${sourceCode.getText(node.test)}) ${statementText}`
  return { compactIf, statementText }
}

const fixToOneLine = ({ fixer, consequent, sourceCode, statementText }) => {
  const tokenBefore = sourceCode.getTokenBefore(consequent)
  return fixer.replaceTextRange([ tokenBefore.range[1], consequent.range[1] ], ` ${statementText}`)
}

export default {
  meta: {
    type: "layout",
    fixable: "code",
    docs: {
      description: "Prefer compact single-line guard clauses when they fit on one line"
    },
    schema: [],
    messages: {
      compactGuardClause: "Collapse this single-statement guard clause to a one-line if statement."
    }
  },
  create(context) {
    const { sourceCode } = context

    return {
      IfStatement(node) {
        if (!isCompactableGuard(node, sourceCode)) return

        const { compactIf, statementText } = buildCompactReplacement(node, sourceCode)
        if (compactIf.length > 120) return

        const { consequent } = node
        context.report({
          node: consequent,
          messageId: "compactGuardClause",
          fix: (fixer) => fixToOneLine({ consequent, fixer, sourceCode, statementText })
        })
      }
    }
  }
}
