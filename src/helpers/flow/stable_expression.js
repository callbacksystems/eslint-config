export function stableExpressionFor(node, bindings) {
  return node?.type === "Identifier" ? bindings.stableValueFor(node) ?? node : node
}
