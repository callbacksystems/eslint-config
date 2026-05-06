// `this.foo.bind(this)` is redundant when `foo` is already an arrow class
// field (auto-bound). Most often appears as a copy-paste leftover.

import { isThisMember } from "#helpers/ast"

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Disallow `this.foo.bind(this)` when `foo` is an arrow class field" },
    schema: [],
    messages: { redundantBind: "`this.{{name}}.bind(this)` is redundant: `{{name}}` is already an arrow class field." }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (isThisBindCall(node)) {
          const classBody = enclosingClassBody(node)
          const fieldName = node.callee.object.property.name
          if (classBody && arrowClassFieldsIn(classBody).has(fieldName)) {
            context.report({
              node,
              messageId: "redundantBind",
              data: { name: fieldName },
              fix: (fixer) => fixer.replaceText(node, context.sourceCode.getText(node.callee.object))
            })
          }
        }
      }
    }
  }
}

function isThisBindCall(call) {
  return isBindOnThisMember(call)
    && call.arguments.length === 1
    && call.arguments[0].type === "ThisExpression"
}

function isBindOnThisMember(call) {
  return call.callee.type === "MemberExpression"
    && call.callee.property.type === "Identifier"
    && call.callee.property.name === "bind"
    && isThisMember(call.callee.object)
    && call.callee.object.property.type === "Identifier"
}

function enclosingClassBody(node) {
  return node.parent ? classBodyOf(node.parent) : null
}

function classBodyOf(node) {
  return node.type === "ClassBody" ? node : enclosingClassBody(node)
}

function arrowClassFieldsIn(classBody) {
  return new Set(classBody.body.filter(isArrowClassField).map((member) => member.key.name))
}

function isArrowClassField(member) {
  return member.type === "PropertyDefinition"
    && member.key.type === "Identifier"
    && member.value?.type === "ArrowFunctionExpression"
}
