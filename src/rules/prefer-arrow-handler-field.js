// `this.foo = this.foo.bind(this)` inside any method (constructor, Stimulus `initialize`/`connect`, etc.) binds
// imperatively. Prefer an arrow class field `foo = () => { ... }` for auto-binding; cleaner, symmetric with
// `removeEventListener`, no manual rebinding needed.

import { isThisMember } from "#helpers/classes"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer arrow class fields over `this.foo = this.foo.bind(this)`" },
    schema: [],
    messages: { preferArrowField: "Use an arrow class field `{{name}} = () => {...}` instead of `.bind(this)`." }
  },
  create(context) {
    return {
      MethodDefinition(node) {
        if (node.value.body) reportThisBindAssignments(context, node.value.body.body)
      }
    }
  }
}

function reportThisBindAssignments(context, statements) {
  statements.filter(isThisBindAssignment).forEach((statement) => {
    context.report({
      node: statement,
      messageId: "preferArrowField",
      data: { name: statement.expression.left.property.name }
    })
  })
}

function isThisBindAssignment(statement) {
  return isAssignmentToThisMember(statement)
    && isBindThisCall(statement.expression.right)
    && statement.expression.right.callee.object.property.name === statement.expression.left.property.name
}

function isAssignmentToThisMember(statement) {
  return statement.type === "ExpressionStatement"
    && statement.expression.type === "AssignmentExpression"
    && isThisMemberWithIdentifierProperty(statement.expression.left)
}

function isThisMemberWithIdentifierProperty(node) {
  return isThisMember(node) && node.property.type === "Identifier"
}

function isBindThisCall(call) {
  return call.type === "CallExpression" && isBindCallee(call.callee) && isSingleThisArg(call.arguments)
}

function isBindCallee(callee) {
  return callee.type === "MemberExpression"
    && callee.property.type === "Identifier"
    && callee.property.name === "bind"
    && isThisMemberWithIdentifierProperty(callee.object)
}

function isSingleThisArg(args) {
  return args.length === 1 && args[0].type === "ThisExpression"
}
