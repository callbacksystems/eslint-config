// `useImperativeHandle` exposing a single method is over-engineered.
// A callback prop (`onAction={fn}`) or a parent-controlled state value
// is simpler and avoids the ref dance.

const isUseImperativeHandle = (node) =>
  node.type === "CallExpression"
  && node.callee.type === "Identifier"
  && node.callee.name === "useImperativeHandle"

const isFactoryFunction = (node) =>
  node?.type === "FunctionExpression" || node?.type === "ArrowFunctionExpression"

const returnedObjectProperties = (block) => {
  const returnStatement = block.body.find((statement) => statement.type === "ReturnStatement")
  return returnStatement?.argument?.type === "ObjectExpression"
    ? returnStatement.argument.properties
    : null
}

const propertiesFromBody = (body) => {
  if (body.type === "ObjectExpression") return body.properties
  if (body.type === "BlockStatement") return returnedObjectProperties(body)
  return null
}

const exposedMembersOf = (call) => {
  const factory = call.arguments[1]
  return isFactoryFunction(factory) ? propertiesFromBody(factory.body) : null
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow `useImperativeHandle` exposing only a single method" },
    schema: [],
    messages: { singleMethod: "`useImperativeHandle` exposes only 1 method. Use a callback prop or controlled state." }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (isUseImperativeHandle(node) && exposedMembersOf(node)?.length === 1) {
          context.report({ node, messageId: "singleMethod" })
        }
      }
    }
  }
}
