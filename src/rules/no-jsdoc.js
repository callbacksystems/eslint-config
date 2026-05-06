// JSDoc is forbidden. Comments explain "why", not "what"; types and
// identifiers do the documentation.

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow JSDoc block comments" },
    schema: [],
    messages: { noJsdoc: "JSDoc is not used in this codebase. Comments should explain *why*, not document signatures." }
  },
  create(context) {
    const { sourceCode } = context

    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type === "Block" && comment.value.startsWith("*")) {
            context.report({ node: comment, messageId: "noJsdoc" })
          }
        }
      }
    }
  }
}
