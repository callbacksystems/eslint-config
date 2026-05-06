// A method, field, or function named for the event it handles (`handleClick`,
// `handleSubmit`) says nothing about what it does. Name it for the action it
// performs (`openDialog`, `save`, `dismiss`). The `handle` prefix is noise.
// Covers methods, getters, class fields, functions, and function-valued consts
// (so a React `const handleClick = () => {}` is caught too); object literals and
// JSX props are left alone. The `on` prefix is NOT banned globally: it collides
// with legitimate uses (visitor helpers like `onTypes`, Svelte `onMount`, the
// "on <thing>" preposition), so it only makes sense in a narrower scope.

import { isFunction } from "#helpers/ast"

const HANDLER_PREFIX = /^handle[A-Z]/u
const NAMED = new Set([ "Identifier", "PrivateIdentifier" ])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow the `handle` name prefix; name for the action, not the event" },
    schema: [],
    messages: { handlerPrefix: "`{{name}}` names the event, not the action. Drop the `handle` prefix." }
  },
  create(context) {
    function reportPrefixed(nameNode) {
      if (NAMED.has(nameNode?.type) && HANDLER_PREFIX.test(nameNode.name)) {
        context.report({ node: nameNode, messageId: "handlerPrefix", data: { name: nameNode.name } })
      }
    }

    return {
      FunctionDeclaration: (node) => reportPrefixed(node.id),
      VariableDeclarator: (node) => reportPrefixed(functionIdOf(node)),
      MethodDefinition: (node) => reportPrefixed(memberKeyOf(node)),
      PropertyDefinition: (node) => reportPrefixed(memberKeyOf(node))
    }
  }
}

function functionIdOf(node) {
  return isFunction(node.init) ? node.id : null
}

function memberKeyOf(node) {
  return isFunction(node.value) && !node.computed ? node.key : null
}
