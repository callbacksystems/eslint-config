// Module-scope `let` is global mutable state: race conditions, untestable,
// hidden coupling. Use a class instance, factory function, or `const` with
// internal mutation (e.g. `Map`/`Set`).

export default {
  meta: {
    type: "problem",
    docs: { description: "Disallow `let`/`var` declarations at module scope" },
    schema: [],
    messages: {
      mutableModuleScope: "Top-level `{{kind}}` is global mutable state. Encapsulate in a class or use `const`."
    }
  },
  create(context) {
    return {
      "Program > VariableDeclaration"(node) {
        if (node.kind === "const") return

        node.declarations.forEach((declarator) => {
          context.report({ node: declarator, messageId: "mutableModuleScope", data: { kind: node.kind } })
        })
      }
    }
  }
}
