// Sentinel strings like `"__smart__"` or `"__lists__"` are untyped magic
// values. Prefer enum-like string union types or proper discriminated unions.

const SENTINEL_PATTERN = /^__\w+__$/u

export default {
  meta: {
    type: "problem",
    docs: { description: "Disallow sentinel string literals (`__name__`)" },
    schema: [],
    messages: {
      sentinelString: "Sentinel string `{{value}}` is untyped magic. Use a string union type or discriminated union."
    }
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string" || !SENTINEL_PATTERN.test(node.value)) return

        context.report({ node, messageId: "sentinelString", data: { value: node.value } })
      }
    }
  }
}
