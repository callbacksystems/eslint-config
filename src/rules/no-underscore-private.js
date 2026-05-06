// Privacy via `#` (JS hard-private) or `private` (TS).
// `_` prefix is legacy convention and silently public.

const isUnderscored = (node) =>
  node.key.type === "Identifier" && node.key.name.startsWith("_")

export default {
  meta: {
    type: "problem",
    docs: { description: "Disallow `_`-prefixed class members; use `#` (JS) or `private` (TS)" },
    schema: [],
    messages: { noUnderscorePrivate: "Use `#{{name}}` or `private {{name}}` instead of `_{{name}}` for class privacy." }
  },
  create(context) {
    const report = (node) => {
      if (!isUnderscored(node)) return

      context.report({
        node: node.key,
        messageId: "noUnderscorePrivate",
        data: { name: node.key.name.replace(/^_+/u, "") }
      })
    }

    return { PropertyDefinition: report, MethodDefinition: report }
  }
}
