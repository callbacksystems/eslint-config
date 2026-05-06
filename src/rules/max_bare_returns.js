// A bare `return` (no value) is an abort: "stop here, nothing to give back." One per function reads as a single early
// exit; more than one means the body is framed negatively in several places. Keep at most one upfront guard and write
// the rest positively (`if (condition) { ... }`). Returns that yield a value are not counted, and nested functions are
// analyzed on their own.

import { isBareReturn, onFunctions, ownNodesIn } from "#helpers/syntax/functions"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit bare `return` (valueless) statements per function" },
    schema: [ { type: "object", properties: { max: { type: "integer", minimum: 1 } }, additionalProperties: false } ],
    defaultOptions: [ { max: 1 } ],
    messages: {
      tooManyBareReturns: "Function has {{count}} bare `return` statements (max {{max}}). Write the rest positively."
    }
  },
  create(context) {
    const { max } = context.options[0]
    return onFunctions((node) => checkFunction(context, node, max))
  }
}

function checkFunction(context, node, max) {
  if (node.body.type !== "BlockStatement") return

  const count = countOwnBareReturns(node)
  if (count > max) {
    context.report({ node, messageId: "tooManyBareReturns", data: { count, max } })
  }
}

function countOwnBareReturns(functionNode) {
  return ownNodesIn(functionNode).filter(isBareReturn).toArray().length
}
