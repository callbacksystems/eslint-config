// `setOpen(true)` hides intent. Prefer `open()` / `close()` or an options
// object: `setState({ open: true })`. Skipped for single-arg calls where
// the boolean IS the value semantically (e.g. setters, toggles).

const isBooleanLiteral = (node) =>
  node.type === "Literal" && typeof node.value === "boolean"

const positionalBooleanFlags = (callExpression) =>
  callExpression.arguments.filter((argument) => isBooleanLiteral(argument))

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow boolean literals as positional call arguments (flag arguments)" },
    schema: [],
    messages: { flagArg: "Boolean flag argument hides intent. Use a named option object or a dedicated method." }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.arguments.length < 2) return

        const flags = positionalBooleanFlags(node)
        if (flags.length === 0) return

        for (const flag of flags) context.report({ node: flag, messageId: "flagArg" })
      }
    }
  }
}
