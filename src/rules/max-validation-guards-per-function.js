// Counts only validation guards (returns that reject input: bare, null, false, undefined, 0, ""). Dispatch branches
// like `if (isStart) return startValue` are a lookup table written as control flow, not validation, so they don't
// count. Many validations at the start usually means extracting a predicate.

import { isValidationGuard, onFunctions } from "#helpers/functions"

const DEFAULT_MAX = 2

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit validation guards (returning null/false/undefined) at the start of a function" },
    schema: [ { type: "object", properties: { max: { type: "integer", minimum: 0 } }, additionalProperties: false } ],
    messages: {
      tooManyGuards: "Function has {{count}} leading validation guards (max {{max}}). Extract validation into a helper."
    }
  },
  create(context) {
    const max = context.options[0]?.max ?? DEFAULT_MAX
    return onFunctions((node) => checkFunction(context, node, max))
  }
}

function checkFunction(context, node, max) {
  if (node.body.type !== "BlockStatement") return

  const count = countLeadingValidationGuards(node.body.body)
  if (count > max) {
    context.report({ node, messageId: "tooManyGuards", data: { count, max } })
  }
}

function countLeadingValidationGuards(statements) {
  return leadingZoneOf(statements).filter(isValidationGuard).length
}

function leadingZoneOf(statements) {
  const breakIndex = statements.findIndex((statement) => !isInZone(statement))
  return breakIndex === -1 ? statements : statements.slice(0, breakIndex)
}

function isInZone(statement) {
  return statement.type === "VariableDeclaration" || isValidationGuard(statement)
}
