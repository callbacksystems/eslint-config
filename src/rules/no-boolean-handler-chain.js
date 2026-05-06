// `return tryA() || tryB() || tryC()` where each function returns `boolean`
// to mean "I handled it" is the dispatcher anti-pattern (Nudge mailDispatcher).
// Use a switch on the action type or a real handler map.

const DEFAULT_MIN = 3

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow boolean-returning handler chains (`a() || b() || c()`)" },
    schema: [ { type: "object", properties: { min: { type: "integer", minimum: 2 } }, additionalProperties: false } ],
    messages: {
      booleanHandlerChain: "Chain of {{count}} boolean handlers. Use `switch` on the discriminator or a handler map."
    }
  },
  create(context) {
    const min = context.options[0]?.min ?? DEFAULT_MIN
    return {
      ReturnStatement(node) {
        if (!node.argument || !isHandlerChain(node.argument, min)) return

        context.report({ node, messageId: "booleanHandlerChain", data: { count: callsIn(node.argument).length } })
      }
    }
  }
}

function isHandlerChain(argument, min) {
  return isCallChain(argument) && callsIn(argument).length >= min
}

function isCallChain(node) {
  return isOrLogical(node) && isCallOrChain(node.left) && isCallOrChain(node.right)
}

function isOrLogical(node) {
  return node.type === "LogicalExpression" && node.operator === "||"
}

function isCallOrChain(node) {
  return node.type === "CallExpression" || isCallChain(node)
}

function callsIn(node) {
  if (node.type === "CallExpression") return [ node ]
  if (isOrLogical(node)) return [ ...callsIn(node.left), ...callsIn(node.right) ]
  return []
}
