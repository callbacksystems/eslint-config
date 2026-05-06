export function contains(container, node) {
  return Boolean(container) && isWithin(node, container.range)
}

export function isWithin(node, [ start, end ]) {
  return node.range[0] >= start && node.range[1] <= end
}

export function isWithinTree(node, container) {
  let current = node
  while (current && current !== container) current = current.parent
  return current === container
}
