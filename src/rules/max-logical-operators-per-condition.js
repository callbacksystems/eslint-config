// Counts &&, ||, ?? operators inside a condition expression. When more than
// one appears together, the predicate has gotten too complex to inline.
// Extract it to a named helper or, when all terms share an object base
// (`user.x && user.y && user.z`), to a getter on that object.

const MAX_OPERATORS = 1

const isLogicalExpression = (node) => Boolean(node) && node.type === "LogicalExpression"

const countLogicalOperators = (node) =>
  isLogicalExpression(node) ? 1 + countLogicalOperators(node.left) + countLogicalOperators(node.right) : 0

const checkCondition = (context, condition) => {
  if (condition) {
    const count = countLogicalOperators(condition)
    if (count > MAX_OPERATORS) {
      context.report({ node: condition, messageId: "tooManyOperators", data: { count, max: MAX_OPERATORS } })
    }
  }
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit logical operators in conditions; extract complex predicates" },
    schema: [],
    messages: {
      tooManyOperators: "Condition has {{count}} logical operators (max {{max}}). Extract into a named predicate."
    }
  },
  create(context) {
    return {
      ConditionalExpression: (node) => checkCondition(context, node.test),
      DoWhileStatement: (node) => checkCondition(context, node.test),
      ForStatement: (node) => checkCondition(context, node.test),
      IfStatement: (node) => checkCondition(context, node.test),
      WhileStatement: (node) => checkCondition(context, node.test)
    }
  }
}
