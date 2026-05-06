// Many local variables in a function signal imperative code that should be declarative: extract methods (often memoized
// getters on a class) instead of threading values through locals. Property assignments (`config.x = 1`) and variables
// inside nested functions are not counted.

import { childNodesOf } from "#helpers/ast"
import { isFunction, onFunctions } from "#helpers/functions"

const DEFAULT_MAX = 3

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit local variable declarations per function; extract methods instead" },
    schema: [ { type: "object", properties: { max: { type: "integer", minimum: 1 } }, additionalProperties: false } ],
    messages: {
      tooManyLocals: "Function declares {{count}} local variables (max {{max}}). Extract methods or memoized getters."
    }
  },
  create(context) {
    const max = context.options[0]?.max ?? DEFAULT_MAX
    return onFunctions((node) => reportExcess(context, node, max))
  }
}

function reportExcess(context, node, max) {
  const count = countOwnDeclarations(node.body)
  if (count > max) {
    context.report({ node, messageId: "tooManyLocals", data: { count, max } })
  }
}

function countOwnDeclarations(node) {
  if (isFunction(node)) return 0

  const here = node.type === "VariableDeclarator" ? 1 : 0
  return here + childNodesOf(node).reduce((total, child) => total + countOwnDeclarations(child), 0)
}
