import { isFunction } from "#helpers/syntax/functions"

const REPEATED_PARENT_TYPES = new Set([ "DoWhileStatement", "WhileStatement" ])
const VALUES_BY_NODE = new WeakMap()

export function repeatedAncestorsOf(node) {
  if (!VALUES_BY_NODE.has(node)) VALUES_BY_NODE.set(node, repeatedAncestorsFrom(node))
  return VALUES_BY_NODE.get(node)
}

function repeatedAncestorsFrom(node) {
  const { parent } = node
  if (!parent || isFunction(parent)) return []

  const ancestors = repeatedAncestorsOf(parent)
  return isRepeatedIn(parent, node) ? [ parent, ...ancestors ] : ancestors
}

function isRepeatedIn(parent, child) {
  if (REPEATED_PARENT_TYPES.has(parent.type)) return true
  if (parent.type === "ForStatement") return parent.init !== child
  return [ "ForInStatement", "ForOfStatement" ].includes(parent.type) && parent.right !== child
}
