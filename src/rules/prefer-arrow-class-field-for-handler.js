// `this.foo = this.foo.bind(this)` in constructor binds via constructor body.
// Prefer arrow class field `foo = () => { ... }` for auto-binding; cleaner,
// symmetric with `removeEventListener`, no constructor body needed.

const isThisMember = (node) =>
  node.type === "MemberExpression" && node.object.type === "ThisExpression"

const isThisMemberWithIdentifierProperty = (node) =>
  isThisMember(node) && node.property.type === "Identifier"

const isBindCallee = (callee) =>
  callee.type === "MemberExpression"
  && callee.property.type === "Identifier"
  && callee.property.name === "bind"
  && isThisMemberWithIdentifierProperty(callee.object)

const isSingleThisArg = (args) =>
  args.length === 1 && args[0].type === "ThisExpression"

const isBindThisCall = (call) =>
  call.type === "CallExpression" && isBindCallee(call.callee) && isSingleThisArg(call.arguments)

const isAssignmentToThisMember = (statement) =>
  statement.type === "ExpressionStatement"
  && statement.expression.type === "AssignmentExpression"
  && isThisMemberWithIdentifierProperty(statement.expression.left)

const isThisBindAssignment = (statement) => {
  if (!isAssignmentToThisMember(statement) || !isBindThisCall(statement.expression.right)) return false

  const leftName = statement.expression.left.property.name
  return statement.expression.right.callee.object.property.name === leftName
}

const reportThisBindAssignments = (context, statements) => {
  statements.filter(isThisBindAssignment).forEach((statement) => {
    context.report({
      node: statement,
      messageId: "preferArrowField",
      data: { name: statement.expression.left.property.name }
    })
  })
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer arrow class fields over `this.foo = this.foo.bind(this)` in constructor" },
    schema: [],
    messages: {
      preferArrowField: "Use an arrow class field `{{name}} = () => {...}` instead of `.bind(this)` in constructor."
    }
  },
  create(context) {
    return {
      "MethodDefinition[kind='constructor']"(node) {
        if (node.value.body) reportThisBindAssignments(context, node.value.body.body)
      }
    }
  }
}
