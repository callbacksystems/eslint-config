// In Stimulus controllers, public methods are imperative verbs without
// `handle`/`on` prefix. Use `change(event)` not `handleChange(event)`.

const HANDLER_PREFIX = /^(handle|on)[A-Z]/u

const isStimulusController = (classNode) =>
  classNode.superClass?.type === "Identifier" && classNode.superClass.name === "Controller"

const isPublicMethod = (member) =>
  member.type === "MethodDefinition"
  && member.kind === "method"
  && member.key.type === "Identifier"
  && member.accessibility !== "private"

const isHandlerPrefixed = (member) => HANDLER_PREFIX.test(member.key.name)

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow `handle`/`on` prefix on Stimulus controller public methods" },
    schema: [],
    messages: { handlerPrefix: "Stimulus action `{{name}}` should be a verb without `handle`/`on` prefix." }
  },
  create(context) {
    return {
      ClassBody(node) {
        if (!isStimulusController(node.parent)) return

        node.body
          .filter(isPublicMethod)
          .filter(isHandlerPrefixed)
          .forEach((member) => {
            context.report({ node: member.key, messageId: "handlerPrefix", data: { name: member.key.name } })
          })
      }
    }
  }
}
