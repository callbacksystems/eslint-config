// Stimulus actions are invoked from the DOM (`data-action`), so they read as
// imperative verbs: `change(event)`, not `onChange(event)`. The `handle` prefix
// is banned everywhere by `no-handler-prefix`; this catches the `on` prefix where
// it is unambiguously an action: a public method or arrow field of a controller.

import { isFunction, isStimulusController } from "#helpers/ast"

const ON_PREFIX = /^on[A-Z]/u

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow the `on` prefix on Stimulus controller actions" },
    schema: [],
    messages: { onPrefix: "Stimulus action `{{name}}` should be a verb without the `on` prefix." }
  },
  create(context) {
    return {
      ClassBody(node) {
        if (isStimulusController(node.parent)) reportActions(context, node.body)
      }
    }
  }
}

function reportActions(context, members) {
  members.filter(isOnPrefixedAction).forEach((member) =>
    context.report({ node: member.key, messageId: "onPrefix", data: { name: member.key.name } }))
}

function isOnPrefixedAction(member) {
  return isPublicAction(member) && ON_PREFIX.test(member.key.name)
}

function isPublicAction(member) {
  return !member.computed
    && member.key?.type === "Identifier"
    && member.accessibility !== "private"
    && isFunctionMember(member)
}

function isFunctionMember(member) {
  return (member.type === "MethodDefinition" && member.kind === "method")
    || (member.type === "PropertyDefinition" && isFunction(member.value))
}
