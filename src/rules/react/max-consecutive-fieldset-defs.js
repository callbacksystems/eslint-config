// 3+ inline sub-component declarations in a row inside the same file mean
// the parent grew vertically with state. Extract each sub-component to its
// own file or compose differently.

const COMPONENT_NAME = /^[A-Z]/u
const DEFAULT_MAX = 3

const isFunctionComponent = (node) =>
  node.type === "FunctionDeclaration"
  && Boolean(node.id)
  && COMPONENT_NAME.test(node.id.name)

const isArrowComponentDeclarator = (declarator) =>
  declarator?.id.type === "Identifier"
  && COMPONENT_NAME.test(declarator.id.name)
  && (declarator.init?.type === "ArrowFunctionExpression"
    || declarator.init?.type === "FunctionExpression")

const isVariableComponent = (node) =>
  node.type === "VariableDeclaration" && isArrowComponentDeclarator(node.declarations[0])

const isComponentDeclaration = (node) => isFunctionComponent(node) || isVariableComponent(node)

const componentRunsIn = (statements) => {
  const runs = []
  let current = null
  for (const statement of statements) {
    if (isComponentDeclaration(statement)) {
      current ??= { start: statement, count: 0 }
      current.count += 1
    } else if (current) {
      runs.push(current)
      current = null
    }
  }
  if (current) runs.push(current)

  return runs
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow 3+ consecutive inline sub-component declarations" },
    schema: [ { type: "object", properties: { max: { type: "integer", minimum: 1 } } } ],
    messages: {
      tooManyConsecutive: "{{count}} consecutive component declarations (max {{max}}). Extract to separate files."
    }
  },
  create(context) {
    const max = context.options[0]?.max ?? DEFAULT_MAX

    return {
      Program(node) {
        for (const run of componentRunsIn(node.body)) {
          if (run.count > max) {
            context.report({ node: run.start, messageId: "tooManyConsecutive", data: { count: run.count, max } })
          }
        }
      }
    }
  }
}
