import { FunctionExecutionContexts } from "#helpers/flow/function_execution_contexts"
import { FunctionActivity } from "#helpers/flow/function_activity"
import { repeatedAncestorsOf } from "#helpers/flow/repeated_ancestors"
import { memberWriteOperationOf } from "#helpers/classes/member_write_targets"
import { CallInvocation } from "#helpers/objects/call_invocation"
import { LocalArgumentValues } from "#helpers/functions/local_argument_values"
import { PropertyWriteArguments } from "#helpers/objects/property_write_arguments"
import { standardPropertyWriteContractMatching } from "#helpers/objects/standard_property_write_contract"
import { GlobalPath } from "#helpers/scope/global_path"

const INDEXES = new WeakMap()

// Identifies a standard global value through stable aliases and rejects uses whose member may already have been
// replaced in this source. Platform contracts still form the semantic boundary; source-visible monkey patches do not.
export class GlobalValueIdentity {
  #bindings

  constructor(bindings) {
    this.#bindings = bindings
  }

  matches(node, globalName, members = []) {
    const path = GlobalPath.from(node, this.#bindings)
    return path?.equals(globalName, members) === true
      && path.pathGuards.every(({ globalName: guardGlobal, members: guardMembers, target }) =>
        this.isUnmodifiedAt(target, guardGlobal, guardMembers))
      && this.isUnmodifiedAt(node, globalName, members)
  }

  isUnmodifiedAt(target, globalName, members) {
    return !indexFor(this.#bindings).replacesBefore(new PathUse(
      new GlobalPath(globalName, members), target, { sourceCode: this.#bindings.sourceCode }))
  }

  isIntrinsicUnmodifiedAt(target, globalName, members) {
    return !indexFor(this.#bindings).replacesExactlyBefore(new PathUse(
      new GlobalPath(globalName, members), target, { sourceCode: this.#bindings.sourceCode }))
  }

  isAbsentAndUnmodifiedAt(target, globalName, members) {
    return !indexFor(this.#bindings).replacesExactlyBefore(new PathUse(
      new GlobalPath(globalName, members), target,
      { sourceCode: this.#bindings.sourceCode, expectsAbsent: true }))
  }
}

function indexFor(bindings) {
  const { sourceCode } = bindings
  if (!INDEXES.has(sourceCode)) INDEXES.set(sourceCode, new GlobalWriteIndex(bindings))
  return INDEXES.get(sourceCode)
}

class GlobalWriteIndex {
  #activity
  #argumentValues
  #bindings
  #byGlobal = new Map()

  constructor(bindings) {
    this.#bindings = bindings
    this.#activity = new FunctionActivity(bindings.sourceCode, bindings)
    const contexts = new FunctionExecutionContexts(bindings.sourceCode.ast)
    contexts.forEach(({ node }) => {
      if (node.type === "MemberExpression") this.#addDirectWrite(node)
    })
    contexts.forEach(({ node }) => {
      if (node.type === "CallExpression") this.#addIndirectWrite(node)
    })
  }

  replacesBefore(use) {
    return this.#byGlobal.get(use.globalName)?.replacesBefore(use) === true
      || this.#byGlobal.get(null)?.replacesBefore(use) === true
  }

  hasDefaultDescriptorPrototypeAt(target, globalName = "Object") {
    return [ "get", "set", "value" ].every((name) => !this.replacesExactlyBefore(new PathUse(
      new GlobalPath(globalName, [ "prototype", name ]), target,
      { sourceCode: this.#bindings.sourceCode, expectsAbsent: true })))
  }

  replacesExactlyBefore(use) {
    return this.#byGlobal.get(use.globalName)?.replacesExactlyBefore(use) === true
  }

  mutationPathsFor(target) {
    return this.#targetValuesOf(target)
      .flatMap((value) => GlobalPath.mutationTargetPathsFor(value, this.#bindings))
  }

  #addDirectWrite(member) {
    const operation = memberWriteOperationOf(member)
    if (operation) {
      GlobalPath.writePathsFor(member, this.#bindings, this.#targetValuesOf(member.object))
        .forEach((path) => this.#addPath(path, operation))
    }
  }

  #targetValuesOf(target) {
    return this.#isParameter(target) ? this.#localArgumentValues.valuesOf(target) : [ target ]
  }

  #isParameter(node) {
    return node.type === "Identifier"
      && this.#bindings.variableFor(node)?.defs.some(({ type }) => type === "Parameter") === true
  }

  get #localArgumentValues() {
    return this.#argumentValues ??= new LocalArgumentValues(this.#bindings.sourceCode, this.#bindings)
  }

  #addPath(path, operation) {
    if (path) {
      if (!this.#byGlobal.has(path.globalName)) this.#byGlobal.set(path.globalName, new GlobalWriteTree())
      this.#byGlobal.get(path.globalName).add(path.members, new IndexedGlobalWrite(
        operation, this.#bindings.sourceCode, { isActive: this.#activity.canExecuteNode(operation) }))
    }
  }

  #addIndirectWrite(call) {
    new IndirectGlobalWrites(call, this.#bindings, this).paths.forEach((path) => this.#addPath(path, call))
  }
}

class PathUse {
  constructor(path, target, { sourceCode, expectsAbsent = false }) {
    this.expectsAbsent = expectsAbsent
    this.globalName = path.globalName
    this.members = path.members
    this.target = target
    this.sourceCode = sourceCode
  }
}

class GlobalWriteTree {
  #children = new Map()
  #writes = new GlobalWrites()

  add(members, write) {
    this.#nodeFor(members).#writes.add(write)
  }

  replacesBefore(use) {
    let nodes = [ this ]
    return use.members.some((member) => {
      if (nodes.some((node) => node.#hasPriorWrite(use, false))) return true

      nodes = nodes.flatMap((node) => node.#childrenFor(member))
      return false
    }) || nodes.some((node) => node.#hasPriorWrite(use, use.expectsAbsent))
  }

  replacesExactlyBefore(use) {
    return this.#nodesAt(use.members).some((node) => node.#hasPriorWrite(use, use.expectsAbsent))
  }

  #nodeFor(members) {
    return members.reduce((node, member) => node.#childFor(member), this)
  }

  #nodesAt(members) {
    return members.reduce((nodes, member) => nodes.flatMap((node) => node.#childrenFor(member)), [ this ])
  }

  #childFor(member) {
    if (!this.#children.has(member)) this.#children.set(member, new GlobalWriteTree())
    return this.#children.get(member)
  }

  #hasPriorWrite(use, expectsAbsent) {
    return this.#writes.replacesBefore(use, { expectsAbsent })
  }

  #childrenFor(member) {
    return Array.from(new Set([ this.#children.get(member), this.#children.get(null) ].filter(Boolean)))
  }
}

class GlobalWrites {
  #forAbsent = new TimedGlobalWrites()
  #forIdentity = new TimedGlobalWrites()

  add(write) {
    const effect = new AssignmentEffect(write.operation)
    if (effect.replacesAbsent) this.#forAbsent.add(write)
    if (effect.replacesIdentity) this.#forIdentity.add(write)
  }

  replacesBefore(use, { expectsAbsent }) {
    return (expectsAbsent ? this.#forAbsent : this.#forIdentity).replacesBefore(use)
  }
}

class TimedGlobalWrites {
  #count = 0
  #firstPosition = Infinity
  #hasPersistentWrite = false
  #localWritesByRoot = new WeakMap()

  add(write) {
    const { operation, sourceCode } = write
    if (write.isActive) {
      this.#count += 1
      this.#firstPosition = Math.min(this.#firstPosition, operation.range[0])
      if (new OneShotProgramExecution(operation, sourceCode).canRepeat) this.#hasPersistentWrite = true
    } else {
      const execution = new OneShotProgramExecution(operation, sourceCode)
      if (!this.#localWritesByRoot.has(execution.root)) {
        this.#localWritesByRoot.set(execution.root, new LocalGlobalWrites())
      }
      this.#localWritesByRoot.get(execution.root).add(operation)
    }
  }

  replacesBefore(use) {
    return (this.#count > 0 && this.#canAffect(use)) || this.#isAffectedByLocalWrite(use)
  }

  #canAffect(use) {
    return new OneShotProgramExecution(use.target, use.sourceCode).isPresent
      ? this.#hasPersistentWrite || this.#firstPosition < use.target.range[1]
      : true
  }

  #isAffectedByLocalWrite(use) {
    const execution = new OneShotProgramExecution(use.target, use.sourceCode)
    return this.#localWritesByRoot.get(execution.root)?.replacesBefore(use.target) === true
  }
}

class OneShotProgramExecution {
  #node
  #sourceCode

  constructor(node, sourceCode) {
    this.#node = node
    this.#sourceCode = sourceCode
  }

  get canRepeat() {
    return !this.isPresent
  }

  get isPresent() {
    return this.root?.type === "Program" && repeatedAncestorsOf(this.#node).length === 0
  }

  get root() {
    return this.#sourceCode.getScope(this.#node).variableScope.block
  }
}

class LocalGlobalWrites {
  #firstCompletion = Infinity
  #repeatedAncestors = new WeakSet()

  add(operation) {
    this.#firstCompletion = Math.min(this.#firstCompletion, operation.range[1])
    repeatedAncestorsOf(operation).forEach((ancestor) => this.#repeatedAncestors.add(ancestor))
  }

  replacesBefore(target) {
    return this.#firstCompletion <= target.range[0]
      || repeatedAncestorsOf(target).some((ancestor) => this.#repeatedAncestors.has(ancestor))
  }
}

class AssignmentEffect {
  #operation

  constructor(operation) {
    this.#operation = operation
  }

  get replacesAbsent() {
    return this.#logicalOperator !== "&&="
  }

  get replacesIdentity() {
    return this.#logicalOperator !== "||=" && this.#logicalOperator !== "??="
  }

  get #logicalOperator() {
    return this.#operation.type === "AssignmentExpression" ? this.#operation.operator : null
  }
}

class IndexedGlobalWrite {
  constructor(operation, sourceCode, { isActive }) {
    this.isActive = isActive
    this.operation = operation
    this.sourceCode = sourceCode
  }
}

class IndirectGlobalWrites {
  #bindings
  #identity
  #index
  #invocation

  constructor(call, bindings, index) {
    this.#bindings = bindings
    this.#index = index
    this.#identity = new IndexedGlobalIdentity(bindings, index)
    this.#invocation = new CallInvocation(call, bindings, {
      isReflectApply: (callee) => this.#identity.matches(callee, "Reflect", [ "apply" ])
    })
  }

  get paths() {
    const contract = standardPropertyWriteContractMatching(({ globalName, memberName }) =>
      this.#identity.matches(this.#invocation.callee, globalName, [ memberName ]))
    return contract && this.#invocation.isExactFor(this.#identity, contract)
      ? new PropertyWriteArguments(this.#invocation.arguments, contract, {
        bindings: this.#bindings,
        hasDefaultDescriptorPrototype: (target, globalName) =>
          this.#index.hasDefaultDescriptorPrototypeAt(target, globalName)
      }).values.flatMap(({ name, target }) =>
        this.#index.mutationPathsFor(target).map((path) => path.extending(name).normalized))
      : []
  }
}

class IndexedGlobalIdentity {
  #bindings
  #index

  constructor(bindings, index) {
    this.#bindings = bindings
    this.#index = index
  }

  matches(node, globalName, members) {
    const path = GlobalPath.from(node, this.#bindings)
    return path?.equals(globalName, members) === true
      ? path.pathGuards.every(({ globalName: guardGlobal, members: guardMembers, target }) =>
        this.isUnmodifiedAt(target, guardGlobal, guardMembers))
      && this.isUnmodifiedAt(node, globalName, members)
      : false
  }

  isUnmodifiedAt(target, globalName, members) {
    return !this.#index.replacesBefore(this.#useOf(target, globalName, members))
  }

  isIntrinsicUnmodifiedAt(target, globalName, members) {
    return !this.#index.replacesExactlyBefore(this.#useOf(target, globalName, members))
  }

  #useOf(target, globalName, members) {
    return new PathUse(new GlobalPath(globalName, members), target, { sourceCode: this.#bindings.sourceCode })
  }
}
