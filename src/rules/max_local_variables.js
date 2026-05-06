// Many local variables in a function signal imperative code that should be declarative: extract methods (often memoized
// getters on a class) instead of threading values through locals. Property assignments (`config.x = 1`) and variables
// inside nested functions are not counted.

import { onFunctions, ownNodesIn } from "#helpers/syntax/functions"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit local variable declarations per function; extract methods instead" },
    schema: [ { type: "object", properties: { max: { type: "integer", minimum: 1 } }, additionalProperties: false } ],
    defaultOptions: [ { max: 3 } ],
    messages: {
      tooManyLocals: "Function declares {{count}} local variables (max {{max}}). Extract methods or memoized getters."
    }
  },
  create(context) {
    const { max } = context.options[0]
    return onFunctions((node) => reportExcess(context, node, max))
  }
}

function reportExcess(context, node, max) {
  const count = countOwnDeclarations(node)
  if (count > max) {
    context.report({ node, messageId: "tooManyLocals", data: { count, max } })
  }
}

function countOwnDeclarations(functionNode) {
  return ownNodesIn(functionNode).filter((node) => node.type === "VariableDeclarator").toArray().length
}
