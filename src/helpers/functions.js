// Functions, the statements that leave them, and the guard shapes built on top.
//
// Terminology:
//   - "Function exit": `return` or `throw`. Leaves the surrounding function.
//   - "Loop control": `continue` or `break`. Stays inside the loop.
//   - "Guard clause": `if (condition) <exit>` with no `else` and a single-statement
//     consequent. By default we mean function-level guards (return/throw),
//     but `padding-after-guard-clause` also treats loop-control guards.
//   - "Validation guard": a guard whose return is "trivial" (bare, null,
//     undefined, false, 0, ""). These reject input. Other guards with
//     meaningful return values are dispatch branches, not validation.

import { onTypes, walk } from "#helpers/ast"
import { memberName } from "#helpers/classes"

const FUNCTION_EXIT_TYPES = new Set([ "ReturnStatement", "ThrowStatement" ])
const LOOP_CONTROL_TYPES = new Set([ "ContinueStatement", "BreakStatement" ])
const ALL_EXIT_TYPES = FUNCTION_EXIT_TYPES.union(LOOP_CONTROL_TYPES)
const TRIVIAL_VALUES = new Set([ null, false, 0, "" ])
const FUNCTION_TYPES = new Set([ "FunctionExpression", "ArrowFunctionExpression" ])
const ENCLOSING_FUNCTION_TYPES = new Set([ "FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression" ])

export function isAnyExit(node) {
  return Boolean(node) && ALL_EXIT_TYPES.has(node.type)
}

export function isBareReturn(node) {
  return Boolean(node) && node.type === "ReturnStatement" && !node.argument
}

export function isReturnWithValue(node) {
  return Boolean(node) && node.type === "ReturnStatement" && Boolean(node.argument)
}

export function isFunctionLike(node) {
  return Boolean(node) && FUNCTION_TYPES.has(node.type)
}

export function isFunction(node) {
  return Boolean(node) && ENCLOSING_FUNCTION_TYPES.has(node.type)
}

export function isValidationGuard(node) {
  if (isGuardClause(node)) {
    const inner = innerExit(node.consequent)
    return inner.type === "ReturnStatement" && isTrivialReturnValue(inner.argument)
  } else {
    return false
  }
}

export function isGuardClause(node, isExit = isFunctionExit) {
  return isIfWithoutAlternate(node)
    && (isExit(node.consequent) || isSingleExitBlock(node.consequent, isExit))
}

export function isFunctionExit(node) {
  return Boolean(node) && FUNCTION_EXIT_TYPES.has(node.type)
}

export function isIfWithoutAlternate(node) {
  return Boolean(node) && node.type === "IfStatement" && !node.alternate
}

export function isSingleExitBlock(block, isExit = isFunctionExit) {
  return block.type === "BlockStatement" && block.body.length === 1 && isExit(block.body[0])
}

export function isTrivialReturnValue(argument) {
  return !argument || isUndefinedIdentifier(argument) || isTrivialLiteral(argument)
}

export function innerStatementOf(consequent) {
  if (consequent.type === "ReturnStatement") return consequent
  if (consequent.type === "BlockStatement" && consequent.body.length === 1) return consequent.body[0]
  return null
}

export function enclosingFunction(node) {
  return node.parent ? functionOf(node.parent) : null
}

export function sharesFunction(first, second) {
  const enclosing = enclosingFunction(first)
  return Boolean(enclosing) && enclosing === enclosingFunction(second)
}

// Ignoring returns that belong to nested functions.
export function returnsAValue(functionNode) {
  const { body } = functionNode
  return body.type !== "BlockStatement"
    || Array.from(walk(body)).some((node) => isReturnWithValue(node) && enclosingFunction(node) === functionNode)
}

export function ownReturnArguments(functionNode) {
  const { body } = functionNode
  if (body.type !== "BlockStatement") return [ body ]

  return Array.from(walk(body))
    .filter((node) => isReturnWithValue(node) && enclosingFunction(node) === functionNode)
    .map((node) => node.argument)
}

export function onFunctions(handler) {
  return onTypes(ENCLOSING_FUNCTION_TYPES, handler)
}

export function functionNameOf(functionNode) {
  return functionNode.type === "FunctionDeclaration" ? functionNode.id.name : memberName(functionNode.parent)
}

// Skipping destructuring and defaults, so a call forwarding the parameters verbatim can be recognised.
export function identifierParameterNames(params) {
  return new Set(params.filter((parameter) => parameter.type === "Identifier").map((parameter) => parameter.name))
}

export function soleStatementOf(functionBody) {
  return functionBody.type === "BlockStatement" && functionBody.body.length === 1 ? functionBody.body[0] : null
}

function innerExit(consequent) {
  return consequent.type === "BlockStatement" ? consequent.body[0] : consequent
}

function isUndefinedIdentifier(node) {
  return Boolean(node) && node.type === "Identifier" && node.name === "undefined"
}

function isTrivialLiteral(node) {
  return Boolean(node) && node.type === "Literal" && TRIVIAL_VALUES.has(node.value)
}

function functionOf(node) {
  return ENCLOSING_FUNCTION_TYPES.has(node.type) ? node : enclosingFunction(node)
}
