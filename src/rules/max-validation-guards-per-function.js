// Counts only validation guards (returns that reject input: bare, null, false,
// undefined, 0, ""). Dispatch branches like `if (isStart) return startValue`
// are a lookup table written as control flow, not validation, so they don't
// count. Many validations at the start usually means extracting a predicate.

import { isValidationGuard } from "#rules/helpers"

const MAX_GUARDS = 2

const isInZone = (statement) =>
  statement.type === "VariableDeclaration" || isValidationGuard(statement)

const countLeadingValidationGuards = (statements) => {
  let count = 0
  for (const statement of statements) {
    if (!isInZone(statement)) break

    if (isValidationGuard(statement)) count += 1
  }
  return count
}

const checkFunction = (context, node) => {
  if (node.body.type !== "BlockStatement") return

  const count = countLeadingValidationGuards(node.body.body)
  if (count > MAX_GUARDS) {
    context.report({ node, messageId: "tooManyGuards", data: { count, max: MAX_GUARDS } })
  }
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Limit validation guards (returning null/false/undefined) at the start of a function"
    },
    schema: [],
    messages: {
      tooManyGuards: "Function has {{count}} leading validation guards (max {{max}}). Extract validation into a helper."
    }
  },
  create(context) {
    return {
      FunctionDeclaration: (node) => checkFunction(context, node),
      FunctionExpression: (node) => checkFunction(context, node),
      ArrowFunctionExpression: (node) => checkFunction(context, node)
    }
  }
}
