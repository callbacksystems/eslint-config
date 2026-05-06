// `return tryA() || tryB() || tryC()` where each function returns `boolean`
// to mean "I handled it" is the dispatcher anti-pattern (Nudge mailDispatcher).
// Use a switch on the action type or a real handler map.

const MIN_HANDLERS = 3

const isOrLogical = (node) => node.type === "LogicalExpression" && node.operator === "||"

const isCallOrChain = (node) => node.type === "CallExpression" || isCallChain(node)

const isCallChain = (node) =>
  isOrLogical(node) && isCallOrChain(node.left) && isCallOrChain(node.right)

const collectCalls = (node) => {
  if (node.type === "CallExpression") return [ node ]
  if (!isOrLogical(node)) return []

  return [ ...collectCalls(node.left), ...collectCalls(node.right) ]
}

const isHandlerChain = (argument) =>
  isCallChain(argument) && collectCalls(argument).length >= MIN_HANDLERS

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow boolean-returning handler chains (`a() || b() || c()`)" },
    schema: [],
    messages: {
      booleanHandlerChain: "Chain of {{count}} boolean handlers. Use `switch` on the discriminator or a handler map."
    }
  },
  create(context) {
    return {
      ReturnStatement(node) {
        if (!node.argument || !isHandlerChain(node.argument)) return

        context.report({ node, messageId: "booleanHandlerChain", data: { count: collectCalls(node.argument).length } })
      }
    }
  }
}
