// `if (condition) return; return X` reads as a doubled-up negation. Inverting to
// `if (!condition) return X` says the same thing positively in one statement.
// JS's implicit `undefined` return covers the falsy case naturally.

import { innerStatementOf, isBareReturn, isIfWithoutAlternate, isReturnWithValue, negated } from "#helpers/ast"

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
    return { BlockStatement: (node) => checkBlock(context, node.body) }
  }
}

function checkBlock(context, body) {
  if (body.length < 2) return

  const previous = body.at(-2)
  const last = body.at(-1)
  if (isReturnWithValue(last) && isIfBareReturn(previous)) {
    context.report({ node: previous, messageId: "preferTailCondition", fix: tailConditionFix(context, previous, last) })
  }
}

function isIfBareReturn(node) {
  return isIfWithoutAlternate(node) && isBareReturn(innerStatementOf(node.consequent))
}

function tailConditionFix(context, ifNode, lastReturn) {
  const { sourceCode } = context
  const replacement = `if (${negated(sourceCode, ifNode.test)}) return ${sourceCode.getText(lastReturn.argument)}`
  return (fixer) => fixer.replaceTextRange([ ifNode.range[0], lastReturn.range[1] ], replacement)
}
