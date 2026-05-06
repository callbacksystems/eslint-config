import { childNodesOf, onTypes, pushReversed } from "#helpers/syntax/ast"
import { isClassMember, memberName } from "#helpers/syntax/classes"
import { NearestAncestor } from "#helpers/syntax/nearest_ancestor"

const FUNCTION_EXIT_TYPES = new Set([ "ReturnStatement", "ThrowStatement" ])
const LOOP_CONTROL_TYPES = new Set([ "ContinueStatement", "BreakStatement" ])
const ALL_EXIT_TYPES = FUNCTION_EXIT_TYPES.union(LOOP_CONTROL_TYPES)
const TRIVIAL_VALUES = new Set([ null, false, 0, "" ])
const FUNCTION_TYPES = new Set([ "FunctionExpression", "ArrowFunctionExpression" ])
const ENCLOSING_FUNCTION_TYPES = new Set([ "FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression" ])
const enclosingFunctions = new NearestAncestor((node) => ENCLOSING_FUNCTION_TYPES.has(node.type))

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

// A guard returning something meaningful is a dispatch branch rather than validation.
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

export function innerStatementOf(consequent) {
  if (consequent.type === "ReturnStatement") return consequent
  if (consequent.type === "BlockStatement" && consequent.body.length === 1) return consequent.body[0]
  return null
}

export function guardReturnOf(guard) {
  const inner = innerStatementOf(guard.consequent)
  return inner?.type === "ReturnStatement" ? inner : null
}

export function enclosingFunction(node) {
  return enclosingFunctions.above(node)
}

export function isInvoked(node) {
  const { parent } = node
  return (parent?.type === "CallExpression" && parent.callee === node)
    || (parent?.type === "TaggedTemplateExpression" && parent.tag === node)
}

export function isInlineFunction(node) {
  return node.parent?.type === "CallExpression"
    && (node.parent.callee === node || node.parent.arguments.includes(node))
}

export function hasOwnArgumentsAccess(functionNode, sourceCode) {
  return Boolean(sourceCode.scopeManager.acquire(functionNode, true)?.set.get("arguments")?.references.length)
}

export function* ownNodesIn(functionNode) {
  const pending = [ functionNode.body ]
  while (pending.length > 0) {
    const current = pending.pop()
    yield current
    if (!isFunction(current)) pushReversed(pending, childNodesOf(current))
  }
}

export function sharesFunction(first, second) {
  const enclosing = enclosingFunction(first)
  return Boolean(enclosing) && enclosing === enclosingFunction(second)
}

export function returnsAValue(functionNode) {
  const { body } = functionNode
  return body.type !== "BlockStatement"
    || ownNodesIn(functionNode).some(isReturnWithValue)
}

export function hasBareReturn(functionNode) {
  const { body } = functionNode
  return body.type === "BlockStatement" && ownNodesIn(functionNode).some(isBareReturn)
}

export function ownReturnArguments(functionNode) {
  const { body } = functionNode
  if (body.type !== "BlockStatement") return [ body ]

  return ownNodesIn(functionNode)
    .filter(isReturnWithValue)
    .map((node) => node.argument)
    .toArray()
}

export function onFunctions(handler) {
  return onTypes(ENCLOSING_FUNCTION_TYPES, handler)
}

export function functionNameOf(functionNode) {
  return functionNode.type === "FunctionDeclaration"
    ? functionNode.id?.name ?? null
    : contextualFunctionNameOf(functionNode)
}

export function identifierParameterNames(params) {
  return new Set(params.map(parameterIdentifier).filter(Boolean).map((parameter) => parameter.name))
}

export function parameterIdentifier(parameter) {
  switch (parameter?.type) {
    case "Identifier": return parameter
    case "AssignmentPattern": return parameter.left.type === "Identifier" ? parameter.left : null
    case "RestElement": return parameter.argument.type === "Identifier" ? parameter.argument : null
    default: return null
  }
}

export function positionalParameterAt(functionNode, position) {
  const parameter = functionNode?.params[position]
  return parameter?.type === "RestElement" ? null : parameterIdentifier(parameter)
}

export function soleStatementOf(functionBody) {
  return functionBody.type === "BlockStatement" && functionBody.body.length === 1 ? functionBody.body[0] : null
}

function isSingleExitBlock(block, isExit = isFunctionExit) {
  return block.type === "BlockStatement" && block.body.length === 1 && isExit(block.body[0])
}

function innerExit(consequent) {
  return consequent.type === "BlockStatement" ? consequent.body[0] : consequent
}

function isTrivialReturnValue(argument) {
  return !argument || isUndefinedIdentifier(argument) || isTrivialLiteral(argument)
}

function isUndefinedIdentifier(node) {
  return Boolean(node) && node.type === "Identifier" && node.name === "undefined"
}

function isTrivialLiteral(node) {
  return Boolean(node) && node.type === "Literal" && TRIVIAL_VALUES.has(node.value)
}

function contextualFunctionNameOf(functionNode) {
  return functionNode.parent?.type === "VariableDeclarator"
    ? variableFunctionNameOf(functionNode)
    : memberFunctionNameOf(functionNode)
}

function variableFunctionNameOf(functionNode) {
  return functionNode.parent.id.type === "Identifier" ? functionNode.parent.id.name : functionNode.id?.name ?? null
}

function memberFunctionNameOf(functionNode) {
  const { parent } = functionNode
  return isClassMember(parent)
    ? memberName(parent)
    : functionNode.id?.name ?? null
}
