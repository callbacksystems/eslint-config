// `a?.b?.c?.d?.e` indicates deep coupling or poor data modeling. Refactor: pre-validate, restructure the type, or
// extract intermediate.

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit optional-chain depth (`a?.b?.c?.d`)" },
    schema: [ { type: "object", properties: { max: { type: "integer", minimum: 1 } }, additionalProperties: false } ],
    defaultOptions: [ { max: 3 } ],
    messages: {
      tooDeep: "Optional chain depth {{count}} exceeds maximum {{max}}. Restructure or extract intermediates."
    }
  },
  create(context) {
    const { max } = context.options[0]
    return {
      ChainExpression(node) {
        const count = countOptionals(node.expression)
        if (count <= max) return

        context.report({ node, messageId: "tooDeep", data: { count, max } })
      }
    }
  }
}

function countOptionals(node) {
  return Array.from(chainNodesFrom(node)).filter(isOptional).length
}

function* chainNodesFrom(node) {
  for (let current = node; isMemberOrCall(current); current = current.object ?? current.callee) yield current
}

function isMemberOrCall(node) {
  return Boolean(node) && (node.type === "MemberExpression" || node.type === "CallExpression")
}

function isOptional(node) {
  return isMemberOrCall(node) && node.optional === true
}
