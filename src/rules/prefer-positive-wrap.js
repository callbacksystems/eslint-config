// When a negative guard `if (!condition) return` is followed by a short happy path
// (≤ 4 lines), wrapping it as `if (condition) { ... }` reads more naturally:
// processing positives is cheaper than negatives. Skipped for longer happy
// paths where indentation would cost more than the negation does.

import { ALL_EXIT_TYPES, isBareReturn, isIfWithoutAlternate } from "#rules/helpers"

const isNegated = (test) => test.type === "UnaryExpression" && test.operator === "!"

const bareReturnConsequent = (consequent) => {
  if (isBareReturn(consequent)) return true
  if (consequent.type !== "BlockStatement" || consequent.body.length !== 1) return false
  return isBareReturn(consequent.body[0])
}

const isNegativeBareGuard = (node) =>
  isIfWithoutAlternate(node) && isNegated(node.test) && bareReturnConsequent(node.consequent)

const childContainsExit = (node) => {
  switch (node.type) {
    case "IfStatement": return containsExit(node.consequent) || containsExit(node.alternate)
    case "BlockStatement": return node.body.some((child) => containsExit(child))
    case "LabeledStatement": return containsExit(node.body)
    default: return false
  }
}

const containsExit = (node) =>
  Boolean(node) && (ALL_EXIT_TYPES.has(node.type) || childContainsExit(node))

const isWrappable = (node) => !containsExit(node)

const lineSpan = (statements) =>
  statements.at(-1).loc.end.line - statements[0].loc.start.line + 1

const MAX_LINES = 4

const isCandidateAt = (body, index) => {
  if (!isNegativeBareGuard(body[index])) return false

  const after = body.slice(index + 1)
  return after.length > 0
    && after.every((statement) => isWrappable(statement))
    && lineSpan(after) <= MAX_LINES
}

const findCandidate = (body) => {
  for (let index = 0; index < body.length; index += 1) {
    if (isCandidateAt(body, index)) return body[index]
  }
  return null
}

const checkFunction = (context, node) => {
  if (node.body.type !== "BlockStatement") return

  const candidate = findCandidate(node.body.body)
  if (candidate) context.report({ node: candidate, messageId: "preferPositiveWrap" })
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer wrapping a short happy path positively over a leading negative guard"
    },
    schema: [],
    messages: {
      preferPositiveWrap: "Wrap positively: `if (condition) { ... }` instead of `if (!condition) return; ...`."
    }
  },
  create(context) {
    return {
      FunctionDeclaration: (node) => checkFunction(context, node),
      FunctionExpression: (node) => checkFunction(context, node),
      ArrowFunctionExpression: (node) => checkFunction(context, node)
    }
  }
}
