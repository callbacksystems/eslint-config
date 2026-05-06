// A parameterless method whose whole body is `return <value>` is a computed
// property in disguise. Expose it as a getter so callers read it as state
// (`obj.size`) instead of calling it (`obj.size()`). Returns that act rather
// than compute (assignment, await, `this` for chaining, a returned function)
// are left as methods, as are conventional methods like `toString`.

import { memberName } from "#helpers/ast"

const RESERVED = new Set([ "toString", "toJSON", "valueOf", "toLocaleString", "render", "clone" ])
const ACTION_RETURNS = new Set([
  "ThisExpression",
  "AssignmentExpression",
  "UpdateExpression",
  "AwaitExpression",
  "YieldExpression",
  "FunctionExpression",
  "ArrowFunctionExpression"
])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer a getter over a parameterless method that only returns a value" },
    schema: [],
    messages: { preferGetter: "`{{name}}` takes no parameters and only returns a value. Make it a getter." }
  },
  create(context) {
    return {
      MethodDefinition(node) {
        if (shouldBeGetter(node)) {
          context.report({ node: node.key, messageId: "preferGetter", data: { name: memberName(node) } })
        }
      }
    }
  }
}

function shouldBeGetter(node) {
  return node.kind === "method"
    && !node.computed
    && isPlainParameterless(node.value)
    && returnsComputedValue(node.value.body)
    && !RESERVED.has(memberName(node))
}

function isPlainParameterless(functionNode) {
  return functionNode.params.length === 0 && !functionNode.async && !functionNode.generator
}

function returnsComputedValue(body) {
  if (body.type !== "BlockStatement" || body.body.length !== 1) return false

  const [ statement ] = body.body
  return statement.type === "ReturnStatement"
    && Boolean(statement.argument)
    && !ACTION_RETURNS.has(statement.argument.type)
}
