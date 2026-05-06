export function isGlobalBooleanCallee(node, bindings) {
  return node.type === "Identifier" && node.name === "Boolean" && bindings.isUnmodifiedGlobal(node)
}
