// React components composing many sibling-imported custom hooks indicate the
// component has been fragmented across same-package files. Inline or extract
// to a single hook with a coherent purpose.

import { countMatching } from "#helpers/ast"

const HOOK_NAME = /^use[A-Z]/u
const COMPONENT_NAME = /^[A-Z]/u
const DEFAULT_MAX = 4

const isHookName = (name) => typeof name === "string" && HOOK_NAME.test(name)

const isRelativePath = (value) =>
  typeof value === "string" && (value.startsWith("./") || value.startsWith("../"))

const hookSpecifiersFrom = (statement) =>
  statement.specifiers
    .map((specifier) => specifier.local.name)
    .filter(isHookName)

const isRelativeImport = (statement) =>
  statement.type === "ImportDeclaration" && isRelativePath(statement.source.value)

const collectInternalHooks = (programNode) =>
  new Set(programNode.body.filter(isRelativeImport).flatMap(hookSpecifiersFrom))

const isComponentLike = (node) => {
  const name = node.id?.name ?? node.parent?.id?.name
  return typeof name === "string" && COMPONENT_NAME.test(name)
}

const isInternalHookCall = (node, internalHooks) =>
  node.type === "CallExpression"
  && node.callee.type === "Identifier"
  && internalHooks.has(node.callee.name)

const tooManyInternalHooksMessage = "Component composes {{count}} internal hooks (max {{max}})."
  + " Inline or consolidate."

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit internal custom hooks composed by a single component" },
    schema: [ { type: "object", properties: { max: { type: "integer", minimum: 1 } } } ],
    messages: { tooManyInternalHooks: tooManyInternalHooksMessage }
  },
  create(context) {
    const max = context.options[0]?.max ?? DEFAULT_MAX
    let internalHooks = new Set()

    const checkComponent = (node) => {
      if (isComponentLike(node)) {
        const count = countMatching(node.body, (child) => isInternalHookCall(child, internalHooks))
        if (count > max) {
          context.report({ node, messageId: "tooManyInternalHooks", data: { count, max } })
        }
      }
    }

    return {
      Program(node) {
        internalHooks = collectInternalHooks(node)
      },
      FunctionDeclaration: checkComponent,
      FunctionExpression: checkComponent,
      ArrowFunctionExpression: checkComponent
    }
  }
}
