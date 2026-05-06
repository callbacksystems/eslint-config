// Counts &&, ||, ?? operators inside a condition expression. When more than one appears together, the predicate has
// gotten too complex to inline. Extract it to a named helper or, when all terms share an object base (`user.x && user.y
// && user.z`), to a getter on that object. Mirrors `Callbacksystems/ComplexConditional` from the RuboCop config.

const DEFAULT_MAX = 1

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit logical operators in conditions; extract complex predicates" },
    schema: [ { type: "object", properties: { max: { type: "integer", minimum: 0 } }, additionalProperties: false } ],
    messages: {
      tooManyOperators: "Condition has {{count}} logical operators (max {{max}}). Extract into a named predicate."
    }
  },
  create(context) {
    const max = context.options[0]?.max ?? DEFAULT_MAX
    return {
      ConditionalExpression: (node) => checkCondition(context, node.test, max),
      DoWhileStatement: (node) => checkCondition(context, node.test, max),
      ForStatement: (node) => checkCondition(context, node.test, max),
      IfStatement: (node) => checkCondition(context, node.test, max),
      WhileStatement: (node) => checkCondition(context, node.test, max)
    }
  }
}

function checkCondition(context, condition, max) {
  if (condition) {
    const count = countLogicalOperators(condition)
    if (count > max) {
      context.report({ node: condition, messageId: "tooManyOperators", data: { count, max } })
    }
  }
}

function countLogicalOperators(node) {
  return isLogicalExpression(node) ? 1 + countLogicalOperators(node.left) + countLogicalOperators(node.right) : 0
}

function isLogicalExpression(node) {
  return Boolean(node) && node.type === "LogicalExpression"
}
