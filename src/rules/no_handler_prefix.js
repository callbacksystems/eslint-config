// A method, field, or function named for the event it handles (`handleClick`, `handleSubmit`) says nothing about what
// it does. Name it for the action it performs (`openDialog`, `save`, `dismiss`). The `handle` prefix is noise. Covers
// methods, getters, class fields, functions, and function-valued consts (so a React `const handleClick = () => {}` is
// caught too); object literals and JSX props are left alone. The `on` prefix is NOT banned globally: it collides with
// legitimate uses (visitor helpers like `onTypes`, Svelte `onMount`, the "on <thing>" preposition), so it only makes
// sense in a narrower scope.

import { isFunction } from "#helpers/syntax/functions"
import { staticMemberKeyOf } from "#helpers/syntax/classes"

const HANDLER_PREFIX = /^handle[A-Z]/u

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow the `handle` name prefix; name for the action, not the event" },
    schema: [],
    messages: { handlerPrefix: "`{{name}}` names the event, not the action. Drop the `handle` prefix." }
  },
  create(context) {
    function reportPrefixed(key) {
      if (key && HANDLER_PREFIX.test(key.name)) {
        context.report({ node: key.node, messageId: "handlerPrefix", data: { name: key.name } })
      }
    }

    return {
      FunctionDeclaration: (node) => reportPrefixed(identifierKeyOf(node.id)),
      VariableDeclarator: (node) => reportPrefixed(functionKeyOf(node)),
      MethodDefinition: (node) => reportPrefixed(memberKeyOf(node)),
      PropertyDefinition: (node) => reportPrefixed(memberKeyOf(node))
    }
  }
}

function identifierKeyOf(node) {
  return node?.type === "Identifier" ? { name: node.name, node } : null
}

function functionKeyOf(node) {
  return isFunction(node.init) ? identifierKeyOf(node.id) : null
}

function memberKeyOf(node) {
  return isFunction(node.value) ? staticMemberKeyOf(node) : null
}
