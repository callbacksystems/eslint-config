// JSDoc is forbidden. Comments explain "why", not "what"; types and identifiers do the documentation.

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow JSDoc block comments" },
    schema: [],
    messages: { noJsdoc: "JSDoc is not used in this codebase. Comments should explain *why*, not document signatures." }
  },
  create(context) {
    return {
      Program() {
        context.sourceCode.getAllComments()
          .filter((comment) => comment.type === "Block" && comment.value.startsWith("*"))
          .forEach((comment) => context.report({ node: comment, messageId: "noJsdoc" }))
      }
    }
  }
}
