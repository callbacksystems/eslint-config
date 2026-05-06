// `if (condition) return; return X` reads as a doubled-up negation. Inverting to
// `if (!condition) return X` says the same thing positively in one statement.
// JS's implicit `undefined` return covers the falsy case naturally.

import { isBareReturn, isIfWithoutAlternate, isReturnWithValue } from "#rules/helpers"

const innerStatement = (consequent) => {
  if (consequent.type === "ReturnStatement") return consequent
  if (consequent.type === "BlockStatement" && consequent.body.length === 1) return consequent.body[0]
  return null
}

const isIfBareReturn = (node) =>
  isIfWithoutAlternate(node) && isBareReturn(innerStatement(node.consequent))

const checkBlock = (context, body) => {
  if (body.length < 2) return

  const last = body.at(-1)
  const previous = body.at(-2)
  if (!isReturnWithValue(last) || !isIfBareReturn(previous)) return

  context.report({ node: previous, messageId: "preferTailCondition" })
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer `if (!condition) return X` over `if (condition) return; return X` at the tail of a block"
    },
    schema: [],
    messages: {
      preferTailCondition: "Use `if (!condition) return X` instead of `if (condition) return; return X`."
    }
  },
  create(context) {
    return {
      BlockStatement: (node) => checkBlock(context, node.body)
    }
  }
}
