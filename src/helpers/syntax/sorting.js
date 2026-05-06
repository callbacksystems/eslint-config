// Not `localeCompare`, which mixes upper and lower case and would reshuffle every snapshot listing globals.

export function alphabetically(first, second) {
  if (first === second) return 0

  return first < second ? -1 : 1
}

export function byPosition(first, second) {
  return first.range[0] - second.range[0]
}

export function byNodePosition(first, second) {
  return byPosition(first.node, second.node)
}

export function byStartPosition(node, position) {
  return node.range[0] - position
}

export function byEndPosition(node, position) {
  return node.range[1] - position
}
