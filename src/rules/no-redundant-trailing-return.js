// Trailing `return null/undefined` is noise in side-effect-only functions
// (JS returns `undefined` implicitly). When other branches return real values,
// the trailing nullish return is part of the contract and stays.

const isNullOrUndefinedLiteral = (argument) => {
  if (!argument) return true
  if (argument.type === "Identifier" && argument.name === "undefined") return true
  return argument.type === "Literal" && argument.value === null
}

const isTrailingNullishReturn = (statement) =>
  statement.type === "ReturnStatement" && isNullOrUndefinedLiteral(statement.argument)

const isNestedFunction = (node) =>
  node.type === "FunctionDeclaration"
  || node.type === "FunctionExpression"
  || node.type === "ArrowFunctionExpression"

const isMeaningfulReturnStatement = (node) =>
  node.type === "ReturnStatement" && Boolean(node.argument) && !isNullOrUndefinedLiteral(node.argument)

const meaningfulReturnInIf = (node) =>
  hasMeaningfulReturn(node.consequent) || hasMeaningfulReturn(node.alternate)

const meaningfulReturnInTry = (node) =>
  hasMeaningfulReturn(node.block)
  || hasMeaningfulReturn(node.handler?.body)
  || hasMeaningfulReturn(node.finalizer)

const meaningfulReturnInSwitch = (node) =>
  node.cases.some((branch) => branch.consequent.some((child) => hasMeaningfulReturn(child)))

const CHILD_HAS_MEANINGFUL_RETURN = {
  IfStatement: meaningfulReturnInIf,
  TryStatement: meaningfulReturnInTry,
  SwitchStatement: meaningfulReturnInSwitch,
  BlockStatement: (node) => node.body.some((child) => hasMeaningfulReturn(child)),
  LabeledStatement: (node) => hasMeaningfulReturn(node.body),
  ForStatement: (node) => hasMeaningfulReturn(node.body),
  ForOfStatement: (node) => hasMeaningfulReturn(node.body),
  ForInStatement: (node) => hasMeaningfulReturn(node.body),
  WhileStatement: (node) => hasMeaningfulReturn(node.body),
  DoWhileStatement: (node) => hasMeaningfulReturn(node.body)
}

const hasMeaningfulReturn = (node) => {
  if (!node || isNestedFunction(node)) return false
  if (isMeaningfulReturnStatement(node)) return true
  return CHILD_HAS_MEANINGFUL_RETURN[node.type]?.(node) ?? false
}

const isReportable = (statements) => {
  if (statements.length < 2) return false
  if (!isTrailingNullishReturn(statements.at(-1))) return false
  return !statements.slice(0, -1).some((statement) => hasMeaningfulReturn(statement))
}

const shouldReport = (node) =>
  node.body.type === "BlockStatement" && isReportable(node.body.body)

const checkFunction = (context, node) => {
  if (shouldReport(node)) {
    context.report({ node: node.body.body.at(-1), messageId: "redundantTrailingReturn" })
  }
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow trailing `return null/undefined` in side-effect-only functions" },
    schema: [],
    messages: { redundantTrailingReturn: "Remove this trailing return. JS returns `undefined` implicitly." }
  },
  create(context) {
    return {
      FunctionDeclaration: (node) => checkFunction(context, node),
      FunctionExpression: (node) => checkFunction(context, node),
      ArrowFunctionExpression: (node) => checkFunction(context, node)
    }
  }
}
