// `this.foo.bind(this)` is redundant when `foo` is already an arrow class
// field (auto-bound). Most often appears as a copy-paste leftover.

const isArrowClassField = (member) =>
  member.type === "PropertyDefinition"
  && member.key.type === "Identifier"
  && member.value?.type === "ArrowFunctionExpression"

const arrowClassFieldsIn = (classBody) =>
  new Set(classBody.body.filter(isArrowClassField).map((member) => member.key.name))

const enclosingClassBody = (node) => {
  let current = node.parent
  while (current && current.type !== "ClassBody") current = current.parent

  return current
}

const isBindOnThisMember = (call) =>
  call.callee.type === "MemberExpression"
  && call.callee.property.type === "Identifier"
  && call.callee.property.name === "bind"
  && call.callee.object.type === "MemberExpression"
  && call.callee.object.object.type === "ThisExpression"
  && call.callee.object.property.type === "Identifier"

const isThisBindCall = (call) =>
  isBindOnThisMember(call)
  && call.arguments.length === 1
  && call.arguments[0].type === "ThisExpression"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow `this.foo.bind(this)` when `foo` is an arrow class field" },
    schema: [],
    messages: { redundantBind: "`this.{{name}}.bind(this)` is redundant: `{{name}}` is already an arrow class field." }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isThisBindCall(node)) return

        const classBody = enclosingClassBody(node)
        const fieldName = node.callee.object.property.name
        if (!classBody || !arrowClassFieldsIn(classBody).has(fieldName)) return

        context.report({ node, messageId: "redundantBind", data: { name: fieldName } })
      }
    }
  }
}
