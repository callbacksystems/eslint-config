// Stimulus controllers: recognising one, and the static config keys the framework reads off the class.

import { isClassNode } from "#helpers/classes"

export const STIMULUS_CONFIG_KEYS = new Set([ "targets", "classes", "values", "outlets" ])

export function isStimulusController(classNode) {
  return classNode.superClass?.type === "Identifier" && classNode.superClass.name === "Controller"
}

export function enclosingStimulusController(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (isClassNode(current) && isStimulusController(current)) return current
  }
  return null
}
