import { isClassNode } from "#helpers/classes"

const CONFIG_KEYS = new Set([ "targets", "classes", "values", "outlets" ])

export function isStimulusController(classNode) {
  return classNode.superClass?.type === "Identifier" && classNode.superClass.name === "Controller"
}

export function enclosingStimulusController(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (isClassNode(current) && isStimulusController(current)) return current
  }
  return null
}

export function isStimulusConfigKey(name) {
  return CONFIG_KEYS.has(name)
}
