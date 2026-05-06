// Custom hooks (`useX`) whose body is a single `return useCallback(...)`,
// `return useMemo(...)`, or `return useEffect(...)` add no value over inlining
// the call at the consumer. The #1 AI-drift smell in React codebases.

const TRIVIAL_RETURNS = new Set([ "useCallback", "useMemo", "useEffect" ])
const HOOK_NAME = /^use[A-Z]/u

const isHookName = (name) => typeof name === "string" && HOOK_NAME.test(name)

const isTrivialReturnCall = (call) =>
  call?.type === "CallExpression"
  && call.callee.type === "Identifier"
  && TRIVIAL_RETURNS.has(call.callee.name)

const isTrivialBody = (body) => {
  if (body.type !== "BlockStatement" || body.body.length !== 1) return false

  const [ statement ] = body.body
  return statement.type === "ReturnStatement" && isTrivialReturnCall(statement.argument)
}

const checkFunction = (context, node, name) => {
  if (isHookName(name) && isTrivialBody(node.body)) {
    context.report({ node, messageId: "trivialHook", data: { name } })
  }
}

const isFunctionLikeInit = (init) =>
  init?.type === "FunctionExpression" || init?.type === "ArrowFunctionExpression"

const isNamedFunctionDeclarator = (node) =>
  node.id.type === "Identifier" && isFunctionLikeInit(node.init)

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow trivial custom hooks that only wrap useCallback/useMemo/useEffect" },
    schema: [],
    messages: { trivialHook: "Hook `{{name}}` only wraps another hook. Inline the call at the consumer." }
  },
  create(context) {
    return {
      FunctionDeclaration(node) {
        if (node.id) checkFunction(context, node, node.id.name)
      },
      VariableDeclarator(node) {
        if (isNamedFunctionDeclarator(node)) checkFunction(context, node.init, node.id.name)
      }
    }
  }
}
