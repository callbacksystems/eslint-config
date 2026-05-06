// Stimulus actions are invoked from the DOM (`data-action`), so they read as imperative verbs: `change(event)`, not
// `onChange(event)`. The `handle` prefix is banned everywhere by `no-handler-prefix`; this catches the `on` prefix
// where it is unambiguously an action: a public method or arrow field of a controller.

import { resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { isFunction } from "#helpers/syntax/functions"
import { isStimulusController } from "#helpers/classes/stimulus"

const ON_PREFIX = /^on[A-Z]/u

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow the `on` prefix on Stimulus controller actions" },
    schema: [],
    messages: { onPrefix: "Stimulus action `{{name}}` should be a verb without the `on` prefix." }
  },
  create(context) {
    const bindings = BindingResolver.for(context.sourceCode)
    return {
      ClassBody(node) {
        if (isStimulusController(node.parent)) reportActions(context, node.body, bindings)
      }
    }
  }
}

function reportActions(context, members, bindings) {
  members.map((member) => new ActionMember(member, bindings).key).filter(Boolean).forEach((key) =>
    context.report({ node: key.node, messageId: "onPrefix", data: { name: key.name } }))
}

class ActionMember {
  #member
  #bindings
  #cachedKey

  constructor(member, bindings) {
    this.#member = member
    this.#bindings = bindings
  }

  get key() {
    return this.#isPublicAction && ON_PREFIX.test(this.#resolvedKey.name) ? this.#resolvedKey : null
  }

  get #isPublicAction() {
    return !this.#member.static
      && Boolean(this.#resolvedKey)
      && this.#resolvedKey.node.type !== "PrivateIdentifier"
      && this.#member.accessibility !== "private"
      && this.#isFunction
  }

  get #resolvedKey() {
    return this.#cachedKey ??= resolvedMemberKeyOf(this.#member, this.#bindings)
  }

  get #isFunction() {
    return (this.#member.type === "MethodDefinition" && this.#member.kind === "method")
      || (this.#member.type === "PropertyDefinition" && isFunction(this.#member.value))
  }
}
