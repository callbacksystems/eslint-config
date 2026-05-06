import { pushAll } from "#helpers/syntax/ast"
import { NearestAncestor } from "#helpers/syntax/nearest_ancestor"

const MEMBER_WRITE_OPERATION_TYPES = new Set([
  "AssignmentExpression",
  "ForInStatement",
  "ForOfStatement",
  "UnaryExpression",
  "UpdateExpression"
])
const writeOperations = new NearestAncestor((node) => MEMBER_WRITE_OPERATION_TYPES.has(node.type))
const targetsByOperation = new WeakMap()
const targetSetsByOperation = new WeakMap()

export function memberWriteOperationTypes() {
  return MEMBER_WRITE_OPERATION_TYPES
}

export function memberWriteTargetsIn(pattern) {
  return new MemberWriteTargets(pattern).values
}

export function memberWriteTargetsOf(operation) {
  if (!targetsByOperation.has(operation)) {
    targetsByOperation.set(operation, new MemberWriteOperation(operation).targets)
  }
  return targetsByOperation.get(operation)
}

export function memberWriteOperationOf(member) {
  const operation = writeOperations.above(member)
  return operation && memberWriteTargetSetOf(operation).has(member) ? operation : null
}

export function isMemberRead(member) {
  const operation = memberWriteOperationOf(member)
  return !operation || new MemberWriteOperation(operation).readsTarget
}

class MemberWriteTargets {
  #pending
  #values = []

  constructor(pattern) {
    this.#pending = [ pattern ]
  }

  get values() {
    while (this.#pending.length > 0) this.#add(this.#pending.pop())
    return this.#values
  }

  #add(node) {
    if (node) {
      switch (node.type) {
        case "MemberExpression":
          this.#values.push(node)
          break
        case "RestElement":
          this.#pending.push(node.argument)
          break
        case "AssignmentPattern":
          this.#pending.push(node.left)
          break
        case "ArrayPattern":
          pushAll(this.#pending, node.elements)
          break
        case "ObjectPattern":
          pushAll(this.#pending, node.properties.map(targetOfProperty))
          break
      }
    }
  }
}

function targetOfProperty(property) {
  return property.type === "Property" ? property.value : property.argument
}

class MemberWriteOperation {
  #node

  constructor(node) {
    this.#node = node
  }

  get readsTarget() {
    return this.#isAssignment ? this.#readsAssignedValue : this.#isUpdate
  }

  get targets() {
    switch (this.#node.type) {
      case "AssignmentExpression": return this.#patternTargets
      case "ForInStatement": return this.#patternTargets
      case "ForOfStatement": return this.#patternTargets
      case "UnaryExpression": return this.#node.operator === "delete" ? this.#memberTarget : []
      case "UpdateExpression": return this.#memberTarget
      default: return []
    }
  }

  get #isAssignment() {
    return this.#node.type === "AssignmentExpression"
  }

  get #readsAssignedValue() {
    return this.#node.operator !== "="
  }

  get #isUpdate() {
    return this.#node.type === "UpdateExpression"
  }

  get #patternTargets() {
    return memberWriteTargetsIn(this.#node.left)
  }

  get #memberTarget() {
    return this.#node.argument.type === "MemberExpression" ? [ this.#node.argument ] : []
  }
}

function memberWriteTargetSetOf(operation) {
  if (!targetSetsByOperation.has(operation)) {
    targetSetsByOperation.set(operation, new Set(memberWriteTargetsOf(operation)))
  }
  return targetSetsByOperation.get(operation)
}
