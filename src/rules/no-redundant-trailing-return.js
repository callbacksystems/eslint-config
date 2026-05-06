// Trailing `return null/undefined` is noise in side-effect-only functions
// (JS returns `undefined` implicitly). When other branches return real values,
// the trailing nullish return is part of the contract and stays.

import { isFunction, onFunctions } from "#helpers/ast"

const CHILD_HAS_MEANINGFUL_RETURN = {
  IfStatement: (node) => [ node.consequent, node.alternate ].some(hasMeaningfulReturn),
  TryStatement: (node) => [ node.block, node.handler?.body, node.finalizer ].some(hasMeaningfulReturn),
  SwitchStatement: (node) => node.cases.some((branch) => branch.consequent.some(hasMeaningfulReturn)),
  BlockStatement: (node) => node.body.some(hasMeaningfulReturn),
  LabeledStatement: (node) => hasMeaningfulReturn(node.body),
  ForStatement: (node) => hasMeaningfulReturn(node.body),
  ForOfStatement: (node) => hasMeaningfulReturn(node.body),
  ForInStatement: (node) => hasMeaningfulReturn(node.body),
  WhileStatement: (node) => hasMeaningfulReturn(node.body),
  DoWhileStatement: (node) => hasMeaningfulReturn(node.body)
}

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Disallow trailing `return null/undefined` in side-effect-only functions" },
    schema: [],
    messages: { redundantTrailingReturn: "Remove this trailing return. JS returns `undefined` implicitly." }
  },
  create(context) {
    return onFunctions((node) => checkFunction(context, node))
  }
}

function hasMeaningfulReturn(node) {
  if (!node || isFunction(node)) return false
  if (isMeaningfulReturnStatement(node)) return true
  return CHILD_HAS_MEANINGFUL_RETURN[node.type]?.(node) ?? false
}

function isMeaningfulReturnStatement(node) {
  return node.type === "ReturnStatement" && Boolean(node.argument) && !isNullOrUndefinedLiteral(node.argument)
}

function isNullOrUndefinedLiteral(argument) {
  if (!argument) return true
  if (argument.type === "Identifier" && argument.name === "undefined") return true
  return argument.type === "Literal" && argument.value === null
}

function checkFunction(context, node) {
  if (shouldReport(node)) {
    const trailing = node.body.body.at(-1)
    context.report({
      node: trailing,
      messageId: "redundantTrailingReturn",
      fix: (fixer) => fixer.removeRange([ context.sourceCode.getTokenBefore(trailing).range[1], trailing.range[1] ])
    })
  }
}

function shouldReport(node) {
  return node.body.type === "BlockStatement" && isReportable(node.body.body)
}

function isReportable(statements) {
  if (statements.length < 2) return false
  if (isTrailingNullishReturn(statements.at(-1))) {
    return !statements.slice(0, -1).some((statement) => hasMeaningfulReturn(statement))
  }
  return false
}

function isTrailingNullishReturn(statement) {
  return statement.type === "ReturnStatement" && isNullOrUndefinedLiteral(statement.argument)
}
