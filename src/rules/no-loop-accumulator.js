// `let acc = []; for (...) acc.push(...); return acc` and similar manual-build
// patterns should be expressed declaratively with map/filter/Object.fromEntries
// or new Map. Skipped when the loop has break/continue/return/throw, where the
// declarative form would lose control flow.

const isEmptyArrayLiteral = (init) =>
  Boolean(init) && init.type === "ArrayExpression" && init.elements.length === 0

const isEmptyObjectLiteral = (init) =>
  Boolean(init) && init.type === "ObjectExpression" && init.properties.length === 0

const isEmptyMapConstruction = (init) =>
  Boolean(init)
  && init.type === "NewExpression"
  && init.callee.type === "Identifier"
  && init.callee.name === "Map"
  && init.arguments.length === 0

const accumulatorKind = (init) => {
  if (isEmptyArrayLiteral(init)) return "array"
  if (isEmptyObjectLiteral(init)) return "object"
  if (isEmptyMapConstruction(init)) return "map"
  return null
}

const accumulatorDeclaration = (statement) => {
  if (statement.type !== "VariableDeclaration" || statement.declarations.length !== 1) return null

  const [ declarator ] = statement.declarations
  if (declarator.id.type !== "Identifier") return null

  const kind = accumulatorKind(declarator.init)
  return kind ? { name: declarator.id.name, kind } : null
}

const isLoop = (node) =>
  node.type === "ForOfStatement" || node.type === "ForInStatement" || node.type === "ForStatement"

const accumulatorMutation = ({ expression }, accumulatorName, kind) => {
  if (kind === "array") return isArrayPush(expression, accumulatorName)
  if (kind === "object") return isObjectAssign(expression, accumulatorName)
  if (kind === "map") return isMapSet(expression, accumulatorName)
  return false
}

const isArrayPush = (expression, name) =>
  expression.type === "CallExpression"
  && expression.callee.type === "MemberExpression"
  && expression.callee.object.type === "Identifier"
  && expression.callee.object.name === name
  && expression.callee.property.type === "Identifier"
  && expression.callee.property.name === "push"

const isObjectAssign = (expression, name) =>
  expression.type === "AssignmentExpression"
  && expression.operator === "="
  && expression.left.type === "MemberExpression"
  && expression.left.object.type === "Identifier"
  && expression.left.object.name === name

const isMapSet = (expression, name) =>
  expression.type === "CallExpression"
  && expression.callee.type === "MemberExpression"
  && expression.callee.object.type === "Identifier"
  && expression.callee.object.name === name
  && expression.callee.property.type === "Identifier"
  && expression.callee.property.name === "set"

const bodyMatchesAccumulator = (body, name, kind) => {
  if (body.type === "ExpressionStatement") return accumulatorMutation(body, name, kind)
  if (body.type !== "BlockStatement" || body.body.length !== 1) return false

  const [ inner ] = body.body
  if (inner.type === "ExpressionStatement") return accumulatorMutation(inner, name, kind)
  if (inner.type === "IfStatement" && !inner.alternate) return bodyMatchesAccumulator(inner.consequent, name, kind)
  return false
}

const SUGGESTIONS = {
  array: "`map`/`filter`/`flatMap`",
  object: "`Object.fromEntries(items.map(...))`",
  map: "`new Map(items.map(...))`"
}

const reportIfMatches = (context, current, next) => {
  const declaration = accumulatorDeclaration(current)
  if (!declaration || !isLoop(next)) return

  if (bodyMatchesAccumulator(next.body, declaration.name, declaration.kind)) {
    context.report({ node: next, messageId: "noLoopAccumulator", data: { suggestion: SUGGESTIONS[declaration.kind] } })
  }
}

const checkBlock = (context, body) => {
  for (let index = 0; index < body.length - 1; index += 1) {
    reportIfMatches(context, body[index], body[index + 1])
  }
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer declarative array/object/Map building over manual loop accumulators" },
    schema: [],
    messages: { noLoopAccumulator: "Replace this manual accumulator loop with {{suggestion}}." }
  },
  create(context) {
    return {
      Program: (node) => checkBlock(context, node.body),
      BlockStatement: (node) => checkBlock(context, node.body),
      SwitchCase: (node) => checkBlock(context, node.consequent)
    }
  }
}
