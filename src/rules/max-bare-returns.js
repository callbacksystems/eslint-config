// A bare `return` (no value) is an abort: "stop here, nothing to give back." One per function reads as a single early
// exit; more than one means the body is framed negatively in several places. Keep at most one upfront guard and write
// the rest positively (`if (condition) { ... }`). Returns that yield a value are not counted, and nested functions are
// analyzed on their own.

import { childNodesOf } from "#helpers/ast"
import { isBareReturn, isFunction, onFunctions } from "#helpers/functions"

const DEFAULT_MAX = 1

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit bare `return` (valueless) statements per function" },
    schema: [ { type: "object", properties: { max: { type: "integer", minimum: 1 } }, additionalProperties: false } ],
    messages: {
      tooManyBareReturns: "Function has {{count}} bare `return` statements (max {{max}}). Write the rest positively."
    }
  },
  create(context) {
    const max = context.options[0]?.max ?? DEFAULT_MAX
    return onFunctions((node) => checkFunction(context, node, max))
  }
}

function checkFunction(context, node, max) {
  if (node.body.type !== "BlockStatement") return

  const count = countOwnBareReturns(node.body)
  if (count > max) {
    context.report({ node, messageId: "tooManyBareReturns", data: { count, max } })
  }
}

function countOwnBareReturns(node) {
  if (isFunction(node)) return 0

  const own = isBareReturn(node) ? 1 : 0
  return own + childNodesOf(node).reduce((total, child) => total + countOwnBareReturns(child), 0)
}
