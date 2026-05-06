const CLASS_NODE_TYPES = new Set([ "ClassDeclaration", "ClassExpression" ])
const MEMOIZATION_OPERATORS = new Set([ "??=", "||=" ])

export function enclosingClass(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (isClassNode(current)) return current
  }
  return null
}

export function isClassNode(node) {
  return CLASS_NODE_TYPES.has(node.type)
}

export function isThisMember(node) {
  return Boolean(node) && node.type === "MemberExpression" && node.object.type === "ThisExpression"
}

export function isMemoization(node) {
  return Boolean(node) && node.type === "AssignmentExpression"
    && MEMOIZATION_OPERATORS.has(node.operator) && isThisMember(node.left)
}

export function keyName(key) {
  return isNamedKey(key) ? key.name : null
}

export function memberName(member) {
  return member.key.type === "PrivateIdentifier" ? `#${member.key.name}` : member.key.name
}

// In the same spelling `memberName` gives, so the two can be matched.
export function calleeMemberName(callee) {
  const { property } = callee
  return property.type === "PrivateIdentifier" ? `#${property.name}` : property.name
}

export function propertyNameOf(node) {
  const { property } = node
  return property.type === "Identifier" || property.type === "PrivateIdentifier" ? property.name : ""
}

function isNamedKey(key) {
  return key?.type === "Identifier" || key?.type === "PrivateIdentifier"
}
