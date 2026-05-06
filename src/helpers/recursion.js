// A value that differs at every step of a recursion cannot be a field, so the rules that would advise one leave it
// alone. Both shapes are read off a single call, with no flow analysis.

import { nodesIn } from "#helpers/ast"
import { calleeMemberName, isThisMember } from "#helpers/classes"
import { functionNameOf } from "#helpers/functions"

// `walk(node.child, node)`: passed directly and as the receiver of a value derived from it, in one call.
export function callSubjectsIn(node) {
  if (node.type !== "CallExpression") return []

  const identifiers = new Set(node.arguments.filter(isIdentifier).map((argument) => argument.name))
  return node.arguments
    .filter(isMemberOfIdentifier)
    .map((argument) => argument.object.name)
    .filter((name) => identifiers.has(name))
}

// `walk(child, node)` inside `walk(node, parent)`: the subject moves down the parameter list.
export function shiftedSubjectsIn(functionNode) {
  return new Recursion(functionNode).shiftedNames
}

function isIdentifier(node) {
  return node.type === "Identifier"
}

function isMemberOfIdentifier(node) {
  return node.type === "MemberExpression" && node.object.type === "Identifier"
}

class Recursion {
  #function
  #cachedSlots

  constructor(functionNode) {
    this.#function = functionNode
  }

  get shiftedNames() {
    return this.#selfCalls.flatMap((call) => this.#shiftedIn(call))
  }

  get #selfCalls() {
    return nodesIn(this.#function).filter((node) => isCallTo(node, functionNameOf(this.#function))).toArray()
  }

  #shiftedIn(call) {
    return call.arguments.flatMap((argument, index) => this.#isShifted(argument, index) ? [ argument.name ] : [])
  }

  #isShifted(argument, index) {
    return isIdentifier(argument) && this.#slots.includes(argument.name) && this.#slots[index] !== argument.name
  }

  // Only a plain identifier can shift, since a destructured parameter has no single name to move.
  get #slots() {
    return this.#cachedSlots ??= this.#function.params.map((pattern) => isIdentifier(pattern) ? pattern.name : null)
  }
}

function isCallTo(node, name) {
  return node.type === "CallExpression" && calleeNameOf(node.callee) === name
}

function calleeNameOf(callee) {
  if (isIdentifier(callee)) return callee.name
  if (isThisMember(callee)) return calleeMemberName(callee)

  return null
}
