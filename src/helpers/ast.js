// Shared AST predicates used across the local rules.
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

const FUNCTION_EXIT_TYPES = new Set([ "ReturnStatement", "ThrowStatement" ])
const LOOP_CONTROL_TYPES = new Set([ "ContinueStatement", "BreakStatement" ])
const ALL_EXIT_TYPES = new Set([ ...FUNCTION_EXIT_TYPES, ...LOOP_CONTROL_TYPES ])
const TRIVIAL_VALUES = new Set([ null, false, 0, "" ])
const FUNCTION_TYPES = new Set([ "FunctionExpression", "ArrowFunctionExpression" ])
const ENCLOSING_FUNCTION_TYPES = new Set([ "FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression" ])
const MEMOIZATION_OPERATORS = new Set([ "??=", "||=" ])
const NEGATION_NEEDS_PARENS = new Set([
  "AssignmentExpression", "BinaryExpression", "ConditionalExpression", "LogicalExpression", "SequenceExpression"
])
const CLASS_NODE_TYPES = new Set([ "ClassDeclaration", "ClassExpression" ])
const HTML_ELEMENT_SUPERCLASS = /^HTML[A-Z]?\w*Element$/u

export const STIMULUS_CONFIG_KEYS = new Set([ "targets", "classes", "values", "outlets" ])

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

export function isSingleLine(node) {
  return node.loc.start.line === node.loc.end.line
}

export function isStimulusController(classNode) {
  return classNode.superClass?.type === "Identifier" && classNode.superClass.name === "Controller"
}

// A class that directly extends a DOM element base (`HTMLElement`, `HTMLDivElement`, ...).
export function isHtmlElementSubclass(classNode) {
  return classNode?.superClass?.type === "Identifier" && HTML_ELEMENT_SUPERCLASS.test(classNode.superClass.name)
}

// A class whose superclass name ends in `Element`: a custom element either
// directly (`extends HTMLElement`) or through an intermediate base whose name
// already carries the suffix (`extends BaseElement`).
export function extendsElementLikeClass(classNode) {
  return classNode?.superClass?.type === "Identifier" && classNode.superClass.name.endsWith("Element")
}

export function enclosingStimulusController(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (CLASS_NODE_TYPES.has(current.type) && isStimulusController(current)) return current
  }
  return null
}

export function enclosingClass(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (CLASS_NODE_TYPES.has(current.type)) return current
  }
  return null
}

export function isThisMember(node) {
  return Boolean(node) && node.type === "MemberExpression" && node.object.type === "ThisExpression"
}

// The static strings a node contributes: a string literal's value, or every
// fixed chunk of a template literal. Empty for anything else.
export function stringValuesOf(node) {
  if (isStringLiteral(node)) return [ node.value ]
  if (node?.type === "TemplateLiteral") return node.quasis.map((quasi) => quasi.value.cooked)

  return []
}

export function isStringLiteral(node) {
  return Boolean(node) && node.type === "Literal" && typeof node.value === "string"
}

export function isMemoization(node) {
  return Boolean(node) && node.type === "AssignmentExpression"
    && MEMOIZATION_OPERATORS.has(node.operator) && isThisMember(node.left)
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

// The inner statement a guard consequent reduces to: a `return` written inline,
// or the sole statement of a one-statement block. Null when neither applies.
export function innerStatementOf(consequent) {
  if (consequent.type === "ReturnStatement") return consequent
  if (consequent.type === "BlockStatement" && consequent.body.length === 1) return consequent.body[0]
  return null
}

export function countMatching(root, predicate) {
  return Array.from(walk(root)).filter(predicate).length
}

export function* walk(node) {
  if (node?.type) {
    yield node
    yield* walkChildren(node)
  }
}

export function firstMatch(root, predicate) {
  return Array.from(walk(root)).find(predicate) ?? null
}

export function enclosingFunction(node) {
  return node.parent ? functionOf(node.parent) : null
}

export function sharesFunction(first, second) {
  const enclosing = enclosingFunction(first)
  return Boolean(enclosing) && enclosing === enclosingFunction(second)
}

// Whether the function's own body returns a value, ignoring returns that belong
// to nested functions.
export function returnsAValue(functionNode) {
  const { body } = functionNode
  return body.type !== "BlockStatement"
    || Array.from(walk(body)).some((node) => isReturnWithValue(node) && enclosingFunction(node) === functionNode)
}

// The arguments of the function's own `return` statements (skipping returns that
// belong to nested functions), or the body itself for an expression-bodied arrow.
export function ownReturnArguments(functionNode) {
  const { body } = functionNode
  if (body.type !== "BlockStatement") return [ body ]

  return Array.from(walk(body))
    .filter((node) => isReturnWithValue(node) && enclosingFunction(node) === functionNode)
    .map((node) => node.argument)
}

export function readReferences(sourceCode, declarator) {
  const [ variable ] = sourceCode.getDeclaredVariables(declarator)
  return variable ? variable.references.filter((reference) => reference.isRead()) : []
}

export function childNodesOf(node) {
  return childKeysOf(node).flatMap((key) => asArray(node[key]).filter(isNode))
}

export function isNode(value) {
  return Boolean(value) && typeof value.type === "string"
}

// Any function node, including declarations: a boundary for own-body recursion.
export function isFunction(node) {
  return Boolean(node) && ENCLOSING_FUNCTION_TYPES.has(node.type)
}

// The name of a method or property key, or null when it has no static name.
export function keyName(key) {
  return isNamedKey(key) ? key.name : null
}

// A class member's display name, with the `#` prefix for private members.
export function memberName(member) {
  return member.key.type === "PrivateIdentifier" ? `#${member.key.name}` : member.key.name
}

// The static property name of a member expression (`foo.bar` -> "bar"), or "" when
// the access is computed and so has no plain name.
export function propertyNameOf(node) {
  const { property } = node
  return property.type === "Identifier" || property.type === "PrivateIdentifier" ? property.name : ""
}

// One handler registered for every function node type: the visitor a rule uses
// to inspect every function (declaration, expression, arrow).
export function onFunctions(handler) {
  return onTypes(ENCLOSING_FUNCTION_TYPES, handler)
}

// One handler registered for each of the given node types: the visitor object a
// rule returns to inspect a fixed set of node kinds.
export function onTypes(types, handler) {
  return Object.fromEntries([ ...types ].map((type) => [ type, handler ]))
}

// The set of a function's plain identifier parameter names (skipping destructuring
// and defaults), used to tell whether a call forwards the parameters verbatim.
export function identifierParameterNames(params) {
  return new Set(params.filter((parameter) => parameter.type === "Identifier").map((parameter) => parameter.name))
}

// The single statement of a function body, or null when the body is not a
// one-statement block.
export function soleStatementOf(functionBody) {
  return functionBody.type === "BlockStatement" && functionBody.body.length === 1 ? functionBody.body[0] : null
}

// The source text for the logical negation of `node`: a leading `!` is dropped
// (double negations cancel), and operators that bind looser than `!` are
// parenthesized so the negation covers the whole expression.
export function negated(sourceCode, node) {
  if (node.type === "UnaryExpression" && node.operator === "!") return sourceCode.getText(node.argument)

  const text = sourceCode.getText(node)
  return NEGATION_NEEDS_PARENS.has(node.type) ? `!(${text})` : `!${text}`
}

// `node`'s source text, parenthesized when its type is among `looserTypes`, so it
// can stand in as an operand of a tighter-binding operator without regrouping.
export function operandText(sourceCode, node, looserTypes) {
  const text = sourceCode.getText(node)
  return looserTypes.has(node.type) ? `(${text})` : text
}

// The declaration under an `export` / `export default` wrapper, or the node
// itself when it is not such an export. Lets a rule treat `export function f(){}`
// or `export const X = 1` like the bare declaration.
export function unwrapExport(node) {
  return node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration"
    ? node.declaration ?? node
    : node
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

function* walkChildren(node) {
  for (const key of childKeysOf(node)) yield* walkValue(node[key])
}

function childKeysOf(node) {
  return Object.keys(node).filter((key) => key !== "parent")
}

function* walkValue(value) {
  if (Array.isArray(value)) {
    for (const item of value) yield* walk(item)
  } else {
    yield* walk(value)
  }
}

function functionOf(node) {
  return ENCLOSING_FUNCTION_TYPES.has(node.type) ? node : enclosingFunction(node)
}

function asArray(value) {
  return Array.isArray(value) ? value : [ value ]
}

function isNamedKey(key) {
  return key?.type === "Identifier" || key?.type === "PrivateIdentifier"
}
