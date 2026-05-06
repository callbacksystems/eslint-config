import { ClassMemberMutationIndex } from "#helpers/classes/class_member_mutation_index"
import { ClassThisBindings } from "#helpers/classes/class_this_bindings"
import { FunctionExecutionContexts } from "#helpers/flow/function_execution_contexts"
import { isFunction } from "#helpers/syntax/functions"
import { isThisMember } from "#helpers/syntax/classes"
import { memberWriteOperationOf } from "#helpers/classes/member_write_targets"
import { NearestAncestor } from "#helpers/syntax/nearest_ancestor"
import { repeatedAncestorsOf } from "#helpers/flow/repeated_ancestors"
import { resolvedRuntimeMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"

const BOUNDARIES = new NearestAncestor(isDispatchBoundary)
const WRITES_BY_SOURCE = new WeakMap()

export class ThisDispatch {
  #bindings
  #classBindings
  #classWrites
  #resolver
  #sourceCode
  #writes

  constructor(sourceCode, { bindings, resolver }) {
    this.#bindings = bindings
    this.#resolver = resolver
    this.#sourceCode = sourceCode
  }

  isExactFor(member) {
    return this.#resolver.isFreshReceiverDispatchExactFor(member)
      && !this.#thisWrites.hasBefore(member) && !this.#hasClassWriteBefore(member)
  }

  get #thisWrites() {
    return this.#writes ??= writesFor(this.#sourceCode, this.#bindings)
  }

  #hasClassWriteBefore(member) {
    const classNode = this.#thisBindings.classOf(member.object)
    return Boolean(classNode) && this.#classMemberWrites.hasBefore(member, {
      classNode, isStatic: !this.#thisBindings.isInstanceOf(member.object, classNode)
    })
  }

  get #thisBindings() {
    return this.#classBindings ??= new ClassThisBindings(this.#sourceCode.ast)
  }

  get #classMemberWrites() {
    return this.#classWrites ??= ClassMemberMutationIndex.for(this.#sourceCode, this.#bindings)
  }
}

function isDispatchBoundary(node) {
  return isFunction(node) || node.type === "PropertyDefinition" || node.type === "StaticBlock"
}

function writesFor(sourceCode, bindings) {
  if (!WRITES_BY_SOURCE.has(sourceCode)) {
    WRITES_BY_SOURCE.set(sourceCode, new ThisMemberWrites(sourceCode.ast, bindings))
  }
  return WRITES_BY_SOURCE.get(sourceCode)
}

class ThisMemberWrites {
  #bindings
  #byBoundary = new WeakMap()
  #globals

  constructor(root, bindings) {
    this.#bindings = bindings
    this.#globals = new GlobalValueIdentity(bindings)
    new FunctionExecutionContexts(root).forEach(({ node }) => {
      if (isThisMember(node)) this.#add(node)
    })
  }

  hasBefore(member) {
    const boundary = BOUNDARIES.above(member)
    return Boolean(boundary)
      && Boolean(this.#byBoundary.get(boundary)?.hasBefore(member, this.#propertyOf(member)))
  }

  #add(member) {
    const operation = memberWriteOperationOf(member)
    if (operation) {
      const boundary = BOUNDARIES.above(member)
      const property = this.#propertyOf(member)
      if (boundary && property?.node.type !== "PrivateIdentifier") {
        this.#writesFor(boundary).add(operation, property)
      }
    }
  }

  #propertyOf(member) {
    return resolvedRuntimeMemberKeyOf(member, { bindings: this.#bindings, globals: this.#globals })
  }

  #writesFor(boundary) {
    if (!this.#byBoundary.has(boundary)) this.#byBoundary.set(boundary, new MemberWrites())
    return this.#byBoundary.get(boundary)
  }
}

class MemberWrites {
  #all = new MemberWriteGroup()
  #byKey = new Map()
  #indeterminate = new MemberWriteGroup()

  add(operation, property) {
    const write = new MemberWrite(operation)
    const key = keyOf(property)
    this.#all.add(write)
    if (key === null) this.#indeterminate.add(write)
    else this.#writesFor(key).add(write)
  }

  hasBefore(member, property) {
    const key = keyOf(property)
    const query = new MemberWriteQuery(member)
    return key === null
      ? this.#all.hasBefore(query)
      : this.#indeterminate.hasBefore(query) || Boolean(this.#byKey.get(key)?.hasBefore(query))
  }

  #writesFor(key) {
    if (!this.#byKey.has(key)) this.#byKey.set(key, new MemberWriteGroup())
    return this.#byKey.get(key)
  }
}

class MemberWriteGroup {
  #operations = new WeakSet()
  #positions = new OperationPositions()
  #writesByLoop = new WeakMap()

  add(write) {
    if (this.#operations.has(write.operation)) return

    this.#operations.add(write.operation)
    this.#positions.add(write.operation, write.position)
    write.repeated.forEach((loop) => this.#index(loop, write.operation))
  }

  hasBefore(query) {
    return this.#positions.hasBefore(query.position, { except: query.operation })
      || query.repeated.some((loop) => this.#writesByLoop.get(loop)?.hasOtherThan(query.operation))
  }

  #index(loop, operation) {
    if (!this.#writesByLoop.has(loop)) this.#writesByLoop.set(loop, new OtherOperations())
    this.#writesByLoop.get(loop).add(operation)
  }
}

class OperationPositions {
  #first
  #second

  add(operation, position) {
    const entry = { operation, position }
    if (!this.#first || position < this.#first.position) {
      this.#second = this.#first
      this.#first = entry
    } else if (!this.#second || position < this.#second.position) {
      this.#second = entry
    }
  }

  hasBefore(position, { except }) {
    const entry = this.#first?.operation === except ? this.#second : this.#first
    return Boolean(entry) && entry.position < position
  }
}

class OtherOperations {
  #first
  #second

  add(operation) {
    if (!this.#first) this.#first = operation
    else if (this.#first !== operation && !this.#second) this.#second = operation
  }

  hasOtherThan(operation) {
    return Boolean(this.#first) && (this.#first !== operation || Boolean(this.#second))
  }
}

class MemberWrite {
  constructor(operation) {
    this.operation = operation
    this.position = writePositionOf(operation)
    this.repeated = repeatedAncestorsOf(operation)
  }
}

function writePositionOf(operation) {
  return [ "ForInStatement", "ForOfStatement" ].includes(operation.type)
    ? operation.right.range[1]
    : operation.range[1]
}

function keyOf(property) {
  return property ? property.pathMember ?? property.name : null
}

class MemberWriteQuery {
  constructor(member) {
    this.operation = memberWriteOperationOf(member)
    this.position = member.range[0]
    this.repeated = repeatedAncestorsOf(member)
  }
}
