// Trailing `return null/undefined` is noise in side-effect-only functions (JS returns `undefined` implicitly). When
// other branches return real values, the trailing nullish return is part of the contract and stays.

import { onFunctions, ownReturnArguments } from "#helpers/functions"
import { rangeStartingAfterLastComment } from "#helpers/source"

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

function checkFunction(context, node) {
  if (shouldReport(node)) {
    const trailing = node.body.body.at(-1)
    context.report({
      node: trailing,
      messageId: "redundantTrailingReturn",
      fix: (fixer) => fixer.removeRange(removalRangeFor(context.sourceCode, trailing))
    })
  }
}

function shouldReport(node) {
  return node.body.type === "BlockStatement"
    && endsWithNullishReturn(node.body.body)
    && ownReturnArguments(node).every(isNullOrUndefinedLiteral)
}

function endsWithNullishReturn(statements) {
  return statements.length >= 2 && isNullishReturn(statements.at(-1))
}

function isNullishReturn(statement) {
  return statement.type === "ReturnStatement" && isNullOrUndefinedLiteral(statement.argument)
}

function isNullOrUndefinedLiteral(argument) {
  if (!argument) return true
  if (argument.type === "Identifier" && argument.name === "undefined") return true
  return argument.type === "Literal" && argument.value === null
}

function removalRangeFor(sourceCode, trailing) {
  const separator = [ sourceCode.getTokenBefore(trailing).range[1], trailing.range[1] ]
  return rangeStartingAfterLastComment(sourceCode, separator)
}
