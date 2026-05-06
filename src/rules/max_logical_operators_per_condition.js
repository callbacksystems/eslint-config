// Counts &&, ||, ?? operators inside a condition expression. When more than one appears together, the predicate has
// gotten too complex to inline. Extract it to a named helper or, when all terms share an object base (`user.x && user.y
// && user.z`), to a getter on that object.

import { countMatching } from "#helpers/syntax/ast"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit logical operators in conditions; extract complex predicates" },
    schema: [ { type: "object", properties: { max: { type: "integer", minimum: 0 } }, additionalProperties: false } ],
    defaultOptions: [ { max: 1 } ],
    messages: {
      tooManyOperators: "Condition has {{count}} logical operators (max {{max}}). Extract into a named predicate."
    }
  },
  create(context) {
    const { max } = context.options[0]
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
  return countMatching(node, isLogicalExpression)
}

function isLogicalExpression(node) {
  return Boolean(node) && node.type === "LogicalExpression"
}
