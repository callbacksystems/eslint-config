import { ExecutionDominance } from "#helpers/flow/execution_dominance"
import { memberWriteOperationOf } from "#helpers/classes/member_write_targets"
import { resolvedRuntimePropertyKeyOf } from "#helpers/classes/resolved_member_key"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"

const IDENTITY_PRESERVING_ASSIGNMENT_OPERATORS = new Set([ "||=", "??=" ])
const indexes = new WeakMap()

export class MemberOverwrites {
  #accesses
  #bindings
  #target
  #variable

  constructor(variable, { accesses, bindings, target }) {
    this.#variable = variable
    this.#accesses = accesses
    this.#bindings = bindings
    this.#target = target
  }

  get exists() {
    return this.#accesses.length > 0
      && indexFor(this.#variable, this.#bindings).replacesPrefix(new WritePrefix(this.#names, this.#target))
  }

  get #names() {
    return this.#accesses.toReversed().map((access) => access.name)
  }
}

function indexFor(variable, bindings) {
  if (!indexes.has(variable)) indexes.set(variable, new MemberWriteIndex(variable, bindings))
  return indexes.get(variable)
}

class MemberWriteIndex {
  #dynamicWrites = new Map()
  #dominance
  #root
  #writes = new Map()

  constructor(variable, bindings) {
    this.#dominance = new ExecutionDominance(bindings.sourceCode.ast)
    this.#root = new WritePathNode(this.#dominance)
    const globals = new GlobalValueIdentity(bindings)
    variable.references.forEach((reference) =>
      this.#add(new MemberWrite(reference.identifier, { dominance: this.#dominance, bindings, globals })))
  }

  replacesPrefix(prefix) {
    return prefix.hasWriteIn(this.#dynamicWrites)
      || prefix.isReplacedIn(this.#root)
      || prefix.hasWriteAtUnknownAccessIn(this.#writes)
  }

  #add(write) {
    if (write.isIndexable) {
      writesAt(this.#writes, write.names.length, this.#dominance).add(write.operation)
      if (write.names.includes(null)) {
        writesAt(this.#dynamicWrites, write.names.length, this.#dominance).add(write.operation)
      } else this.#root.add(write.names, write)
    }
  }
}

class WritePathNode {
  #dominance
  #children = new Map()

  constructor(dominance) {
    this.#dominance = dominance
    this.writes = dominance.positions
  }

  add(names, write) {
    let current = this.#childFor(names[0])
    for (let index = 1; index < names.length; index += 1) current = current.#childFor(names[index])
    current.writes.add(write.operation)
  }

  childAt(name) {
    return this.#children.get(name) ?? null
  }

  #childFor(name) {
    if (!this.#children.has(name)) this.#children.set(name, new WritePathNode(this.#dominance))
    return this.#children.get(name)
  }
}

class MemberWrite {
  #bindings
  #cachedNames
  #cachedOperation
  #dominance
  #globals
  #identifier
  #members = []

  constructor(identifier, { bindings, dominance, globals }) {
    this.#identifier = identifier
    this.#bindings = bindings
    this.#dominance = dominance
    this.#globals = globals
    this.#build()
  }

  get isIndexable() {
    return Boolean(this.operation) && this.#isGuaranteedReplacement
      && this.#dominance.hasPositionAfter(this.operation)
  }

  get operation() {
    return this.#operation
  }

  get names() {
    return this.#cachedNames ??= this.#members.map((member) =>
      resolvedRuntimePropertyKeyOf(member, { bindings: this.#bindings, globals: this.#globals }))
  }

  #build() {
    let current = this.#identifier
    while (new ParentRelation(current).isMemberObject) {
      this.#members.push(current.parent)
      current = current.parent
    }
  }

  get #isGuaranteedReplacement() {
    if (this.operation.type === "UpdateExpression") return true
    if (this.operation.type === "UnaryExpression") return this.operation.operator === "delete"
    return this.operation.type === "AssignmentExpression"
      && !IDENTITY_PRESERVING_ASSIGNMENT_OPERATORS.has(this.operation.operator)
  }

  get #operation() {
    if (this.#cachedOperation === undefined) {
      this.#cachedOperation = this.#members.length > 0 ? memberWriteOperationOf(this.#members.at(-1)) : null
    }
    return this.#cachedOperation
  }
}

class ParentRelation {
  #node

  constructor(node) {
    this.#node = node
  }

  get isMemberObject() {
    return this.#node.parent?.type === "MemberExpression" && this.#node.parent.object === this.#node
  }
}

function writesAt(writes, depth, dominance) {
  if (!writes.has(depth)) writes.set(depth, dominance.positions)
  return writes.get(depth)
}

class WritePrefix {
  #names
  #target

  constructor(names, target) {
    this.#names = names
    this.#target = target
  }

  hasWriteIn(writes) {
    return this.#names.some((_name, index) => writes.get(index + 1)?.hasBefore(this.#target))
  }

  isReplacedIn(root) {
    let current = root
    return this.#names.some((name) => {
      current = name === null ? null : current?.childAt(name)
      return current?.writes.hasBefore(this.#target)
    })
  }

  hasWriteAtUnknownAccessIn(writes) {
    const firstUnknown = this.#names.indexOf(null)
    return firstUnknown !== -1 && this.#names.some((_name, index) =>
      index >= firstUnknown && writes.get(index + 1)?.hasBefore(this.#target))
  }
}
