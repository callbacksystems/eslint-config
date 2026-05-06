// `a?.b?.c?.d?.e` indicates deep coupling or poor data modelling.
// Refactor: pre-validate, restructure the type, or extract intermediate.

const MAX_DEPTH = 3

const isMemberOrCall = (node) =>
  Boolean(node) && (node.type === "MemberExpression" || node.type === "CallExpression")

const isOptional = (node) => isMemberOrCall(node) && node.optional === true

const countOptionals = (node) => {
  let count = 0
  let current = node
  while (isMemberOrCall(current)) {
    if (isOptional(current)) count += 1
    current = current.object ?? current.callee
  }
  return count
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow deeply chained optional access (`a?.b?.c?.d`)" },
    schema: [],
    messages: {
      deepOptionalChain: "Optional chain depth {{count}} exceeds maximum {{max}}. Restructure or extract intermediates."
    }
  },
  create(context) {
    return {
      ChainExpression(node) {
        const count = countOptionals(node.expression)
        if (count <= MAX_DEPTH) return

        context.report({ node, messageId: "deepOptionalChain", data: { count, max: MAX_DEPTH } })
      }
    }
  }
}
