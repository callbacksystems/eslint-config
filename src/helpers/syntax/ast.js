const FUNCTION_OR_CLASS_TYPES = new Set([ "FunctionDeclaration", "ClassDeclaration" ])
const COMPARISON_OPERATORS = new Set([ "===", "!==", "==", "!=", "<", "<=", ">", ">=", "instanceof", "in" ])
const RESOURCE_DECLARATION_KINDS = new Set([ "await using", "using" ])

export function isComparison(node) {
  return node.type === "BinaryExpression" && COMPARISON_OPERATORS.has(node.operator)
}

// A rule that rewrites a returned value needs certainty, and a truthy `condition` is not the boolean `true`.
export function isProvablyBoolean(node, { isBooleanCall = () => false } = {}) {
  return Boolean(node) && booleanLeavesIn(node)
    .every((candidate) => isBooleanLeaf(candidate, isBooleanCall))
}

export function booleanOperandsOf(expression) {
  if (expression.type === "LogicalExpression") return [ expression.left, expression.right ]
  if (expression.type === "ConditionalExpression") return [ expression.consequent, expression.alternate ]
  if (expression.type === "AwaitExpression") return [ expression.argument ]
  if (expression.type === "SequenceExpression") return [ expression.expressions.at(-1) ]
  return expression.type === "AssignmentExpression" && expression.operator === "=" ? [ expression.right ] : null
}

export function pushAll(target, values) {
  for (const value of values) target.push(value)
}

export function isSingleLine(node) {
  return node.loc.start.line === node.loc.end.line
}

export function isStringLiteral(node) {
  return Boolean(node) && node.type === "Literal" && typeof node.value === "string"
}

export function isStaticTemplateLiteral(node) {
  return node?.type === "TemplateLiteral" && node.expressions.length === 0
}

export function isResourceDeclaration(node) {
  return node?.type === "VariableDeclaration" && RESOURCE_DECLARATION_KINDS.has(node.kind)
}

export function statementInsideLabels(node) {
  while (node.type === "LabeledStatement") node = node.body
  return node
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
  const pending = node?.type ? [ node ] : []
  while (pending.length > 0) {
    const current = pending.pop()
    yield current
    pushChildrenOf(current, pending)
  }
}

export function pushReversed(target, values) {
  for (let index = values.length - 1; index >= 0; index -= 1) target.push(values[index])
}

export function childNodesOf(node) {
  return childKeysOf(node).flatMap((key) => asArray(node[key]).filter((value) => value?.parent === node))
}

export function readReferences(sourceCode, declarator) {
  const [ variable ] = sourceCode.getDeclaredVariables(declarator)
  return variable.references.filter((reference) => reference.isRead())
}

export function onTypes(types, handler) {
  return Object.fromEntries(Array.from(types, (type) => [ type, handler ]))
}

export function isFunctionOrClass(node) {
  return FUNCTION_OR_CLASS_TYPES.has(unwrapExport(node).type)
}

export function unwrapExport(node) {
  return node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration"
    ? node.declaration ?? node
    : node
}

function* booleanLeavesIn(root) {
  const pending = [ root ]
  while (pending.length > 0) {
    const current = pending.pop()
    const children = booleanOperandsOf(current)
    if (children) pushAll(pending, children)
    else yield current
  }
}

function isBooleanLeaf(candidate, isBooleanCall) {
  return candidate.type === "CallExpression"
    ? isBooleanCall(candidate)
    : [ isBooleanLiteral, isBooleanNegation, isComparison ].some((predicate) => predicate(candidate))
}

function isBooleanLiteral(candidate) {
  return candidate.type === "Literal" && typeof candidate.value === "boolean"
}

function isBooleanNegation(candidate) {
  return candidate.type === "UnaryExpression" && candidate.operator === "!"
}

function pushChildrenOf(parent, pending) {
  pushReversed(pending, childNodesOf(parent))
}

function childKeysOf(parent) {
  return Object.keys(parent).filter((key) => key !== "parent")
}

function asArray(value) {
  return Array.isArray(value) ? value : [ value ]
}
