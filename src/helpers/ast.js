const FUNCTION_OR_CLASS_TYPES = new Set([ "FunctionDeclaration", "ClassDeclaration" ])
const COMPARISON_OPERATORS = new Set([ "===", "!==", "==", "!=", "<", "<=", ">", ">=", "instanceof", "in" ])
const PROVABLY_BOOLEAN = {
  Literal: (node) => typeof node.value === "boolean",
  UnaryExpression: (node) => node.operator === "!",
  BinaryExpression: isComparison,
  LogicalExpression: (node) => [ node.left, node.right ].every(isProvablyBoolean),
  ConditionalExpression: (node) => [ node.consequent, node.alternate ].every(isProvablyBoolean),
  CallExpression: (node) => node.callee.type === "Identifier" && node.callee.name === "Boolean"
}

export function isComparison(node) {
  return node.type === "BinaryExpression" && COMPARISON_OPERATORS.has(node.operator)
}

// Narrower than the name-based inference in `boolean-naming`: a rule that rewrites a returned value needs certainty,
// and a truthy `condition` is not the boolean `true`.
export function isProvablyBoolean(node) {
  return Boolean(node) && Boolean(PROVABLY_BOOLEAN[node.type]?.(node))
}

export function isSingleLine(node) {
  return node.loc.start.line === node.loc.end.line
}

export function isStringLiteral(node) {
  return Boolean(node) && node.type === "Literal" && typeof node.value === "string"
}

export function stringValuesOf(node) {
  if (isStringLiteral(node)) return [ node.value ]
  if (node?.type === "TemplateLiteral") return node.quasis.map((quasi) => quasi.value.cooked)

  return []
}

export function countMatching(root, predicate) {
  return nodesIn(root).filter(predicate).toArray().length
}

export function* nodesIn(node) {
  if (node?.type) {
    yield node
    yield* nodesInChildren(node)
  }
}

export function firstMatch(root, predicate) {
  return nodesIn(root).find(predicate) ?? null
}

export function childNodesOf(node) {
  return childKeysOf(node).flatMap((key) => asArray(node[key]).filter(isNode))
}

export function isNode(value) {
  return Boolean(value) && typeof value.type === "string"
}

export function readReferences(sourceCode, declarator) {
  const [ variable ] = sourceCode.getDeclaredVariables(declarator)
  return variable ? variable.references.filter((reference) => reference.isRead()) : []
}

export function onTypes(types, handler) {
  return Object.fromEntries([ ...types ].map((type) => [ type, handler ]))
}

export function isFunctionOrClass(node) {
  return FUNCTION_OR_CLASS_TYPES.has(unwrapExport(node).type)
}

export function unwrapExport(node) {
  return node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration"
    ? node.declaration ?? node
    : node
}

function* nodesInChildren(node) {
  for (const key of childKeysOf(node)) yield* nodesInValue(node[key])
}

function childKeysOf(node) {
  return Object.keys(node).filter((key) => key !== "parent")
}

function* nodesInValue(value) {
  if (Array.isArray(value)) {
    for (const item of value) yield* nodesIn(item)
  } else {
    yield* nodesIn(value)
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [ value ]
}
