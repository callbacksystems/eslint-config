// When two consecutive returns both produce values, the function is
// computing one of two outcomes; express it as a single expression. Skipped
// for chained guards where the same pattern is the natural happy-path style,
// and for returns of multi-line expressions or non-trivial object/array
// literals where a ternary would hurt readability.

import { isIfWithoutAlternate, isReturnWithValue } from "#helpers/ast"

const getInnerReturn = (consequent) => {
  if (consequent.type === "ReturnStatement") return consequent
  if (consequent.type !== "BlockStatement" || consequent.body.length !== 1) return null

  const inner = consequent.body[0]
  return inner.type === "ReturnStatement" ? inner : null
}

const isIfReturnWithoutAlternate = (node) => {
  if (!isIfWithoutAlternate(node)) return false

  const innerReturn = getInnerReturn(node.consequent)
  return Boolean(innerReturn) && Boolean(innerReturn.argument)
}

const isFalseLiteral = (node) => node && node.type === "Literal" && node.value === false
const isTrueLiteral = (node) => node && node.type === "Literal" && node.value === true

const isMultiLine = (node) => node.loc.start.line !== node.loc.end.line

const isComplexLiteral = (node) =>
  (node.type === "ObjectExpression" && node.properties.length > 1)
  || (node.type === "ArrayExpression" && node.elements.length > 1)

const fitsInTernary = (argument) =>
  Boolean(argument) && !isMultiLine(argument) && !isComplexLiteral(argument)

const suggestionFor = (ifNode) => {
  const innerArgument = getInnerReturn(ifNode.consequent).argument
  if (isFalseLiteral(innerArgument)) return "`return !condition && Y`"
  if (isTrueLiteral(innerArgument)) return "`return condition || Y`"
  return "`return condition ? X : Y`"
}

const matchesPattern = (body) =>
  body.length >= 2
  && isReturnWithValue(body.at(-1))
  && isIfReturnWithoutAlternate(body.at(-2))
  && !isIfReturnWithoutAlternate(body.at(-3))

const isReportable = (body) => {
  if (!matchesPattern(body)) return false

  const innerReturn = getInnerReturn(body.at(-2).consequent)
  return fitsInTernary(innerReturn.argument) && fitsInTernary(body.at(-1).argument)
}

const checkBlock = (context, body) => {
  if (isReportable(body)) {
    const previous = body.at(-2)
    context.report({ node: previous, messageId: "preferTernaryReturn", data: { suggestion: suggestionFor(previous) } })
  }
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer a single return expression over `if (condition) return X; return Y`" },
    schema: [],
    messages: { preferTernaryReturn: "Replace `if (condition) return X; return Y` with {{suggestion}}." }
  },
  create(context) {
    return { BlockStatement: (node) => checkBlock(context, node.body) }
  }
}
