import { classDeclaringPrivate, isLexicalThisOf } from "#helpers/syntax/classes"
import { ClassInitializationContext } from "#helpers/classes/class_initialization_context"
import { FreshMemberValue } from "#helpers/flow/fresh_member_value"
import { isFunction } from "#helpers/syntax/functions"
import { memberWriteOperationOf } from "#helpers/classes/member_write_targets"
import { nodesIn } from "#helpers/syntax/ast"
import { isResolvedMemberKeyValid, resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { hasDirectEvalIn } from "#helpers/scope/dynamic_scope"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"

const VISITING = "visiting"

export class ReceiverMembers {
  #classMemberResolution
  #globals
  #safeInitializations = new WeakMap()
  #safety

  constructor(bindings, classMemberResolution) {
    this.bindings = bindings
    this.#classMemberResolution = classMemberResolution
    this.#globals = new GlobalValueIdentity(bindings)
    this.#safety = new ReceiverSafety(this)
  }

  isSafeCall(receiver, member) {
    const property = resolvedMemberKeyOf(member, this.bindings)
    const before = receiver.type === "ObjectExpression"
      ? null
      : new ClassInitializationContext(member, receiver).directElement
    return Boolean(property)
      && Boolean(new ReceiverMember(receiver, property, { before, members: this }).safeFunctionNode)
  }

  functionAt({ property, receiver }) {
    return new ReceiverMember(receiver, property, { members: this }).functionNode
  }

  safeFunctionAt({ property, receiver }) {
    return new ReceiverMember(receiver, property, { members: this }).safeFunctionNode
  }

  safeFunctionFor(receiverMember) {
    const functionNode = this.functionFor(receiverMember)
    return functionNode && this.#safety.isSafeFunction(receiverMember.receiver, functionNode, receiverMember.before)
      ? functionNode
      : null
  }

  functionFor(receiverMember) {
    const value = receiverMember.isObject
      ? this.#freshValueFor(receiverMember)
      : this.#classMemberResolution(receiverMember.receiver, receiverMember.property, {
        before: receiverMember.before,
        kind: "function"
      }).functionNode
    return this.#callableValueOf(value)
  }

  hasSafeInitialization(receiver) {
    if (receiver.type === "ObjectExpression") return true

    if (!this.#safeInitializations.has(receiver)) {
      this.#safeInitializations.set(receiver, receiver.body.body
        .filter((member) => member.static || member.type === "StaticBlock")
        .every((member) => this.#hasSafeStaticInitialization(receiver, member)))
    }
    return this.#safeInitializations.get(receiver)
  }

  isCallable(receiverMember) {
    return Boolean(this.functionFor(receiverMember))
  }

  isCallableAt({ property, receiver }) {
    return Boolean(new ReceiverMember(receiver, property, { members: this }).functionNode)
  }

  isValidProperty(property) {
    return isResolvedMemberKeyValid(property, this.#globals)
  }

  isStableDataAt({ property, receiver }) {
    return new ReceiverMember(receiver, property, { members: this }).isStableData
  }

  isSafeRead(receiverMember) {
    if (receiverMember.isObject) return typeof this.#freshValueFor(receiverMember) !== "string"

    const resolution = this.#classMemberResolution(receiverMember.receiver, receiverMember.property, {
      before: receiverMember.before,
      kind: "getter"
    })
    return !resolution.isAbsent && !resolution.isUnknown && !resolution.functionNode
  }

  isStableData(receiverMember) {
    if (receiverMember.isObject) return typeof this.#freshValueFor(receiverMember) !== "string"

    const resolution = this.#classMemberResolution(receiverMember.receiver, receiverMember.property, {
      before: receiverMember.before,
      kind: "data"
    })
    return !resolution.isAbsent && !resolution.isUnknown
  }

  #freshValueFor(receiverMember) {
    return new FreshMemberValue(receiverMember.receiver, {
      access: { arrayIndex: null, name: receiverMember.name },
      bindings: this.bindings
    }).value
  }

  #callableValueOf(value) {
    if (isFunction(value)) return value
    return value?.type === "Identifier" ? this.bindings.functionFor(value) : null
  }

  #hasSafeStaticInitialization(receiver, member) {
    if (member.type === "StaticBlock") {
      return this.#safety.areUsesSafe(receiver, member, { before: member, thisBoundary: member })
    }
    return member.type !== "PropertyDefinition" || !member.value
      || this.#safety.areUsesSafe(receiver, member.value, { before: member, thisBoundary: member })
  }
}

class ReceiverSafety {
  #members
  #statesByReceiver = new WeakMap()

  constructor(members) {
    this.#members = members
  }

  isSafeFunction(receiver, functionNode, before = null) {
    const states = this.#statesFor(receiver).at(before)
    const state = states.get(functionNode)
    if (state === VISITING) return true
    if (typeof state === "boolean") return state

    return this.#inspectFunction(receiver, functionNode, { before, states })
  }

  areUsesSafe(receiver, root, { before = null, thisBoundary }) {
    return !hasDirectEvalIn(this.#members.bindings.sourceCode, root)
      && nodesIn(root).every((node) => new ReceiverUse(
        node, { members: this.#members, before, receiver, thisBoundary }).isSafe)
  }

  #statesFor(receiver) {
    if (!this.#statesByReceiver.has(receiver)) this.#statesByReceiver.set(receiver, new ReceiverSafetyStates())
    return this.#statesByReceiver.get(receiver)
  }

  #inspectFunction(receiver, functionNode, { before, states }) {
    states.set(functionNode, VISITING)
    const thisBoundary = receiver.type === "ObjectExpression" && functionNode.type === "ArrowFunctionExpression"
      ? null
      : functionNode
    states.set(functionNode, this.areUsesSafe(receiver, functionNode, { before, thisBoundary }))
    return states.get(functionNode)
  }
}

class ReceiverUse {
  #before
  #members
  #node
  #receiver
  #thisBoundary

  constructor(node, { before = null, members, receiver, thisBoundary }) {
    this.#before = before
    this.#node = node
    this.#members = members
    this.#receiver = receiver
    this.#thisBoundary = thisBoundary
  }

  get isSafe() {
    if (this.#isDynamicCode) return false
    if (!this.#isReceiverSubject) return true
    if (this.#node.type === "Super") return false

    return this.#member ? this.#isSafeMember : false
  }

  get #isDynamicCode() {
    return this.#node.type === "WithStatement"
  }

  get #isReceiverSubject() {
    return (this.#node.type === "ThisExpression" || this.#node.type === "Super")
      && isLexicalThisOf(this.#node, this.#thisBoundary)
  }

  get #member() {
    const { parent } = this.#node
    return parent?.type === "MemberExpression" && parent.object === this.#node ? parent : null
  }

  get #isSafeMember() {
    const property = resolvedMemberKeyOf(this.#member, this.#members.bindings)
    if (!property) return false

    const receiverMember = new ReceiverMember(
      this.#receiver, property, { before: this.#before, members: this.#members })
    if (memberWriteOperationOf(this.#member)) return receiverMember.isSafeWrite
    return this.#isInvoked ? Boolean(receiverMember.safeFunctionNode) : receiverMember.isSafeRead
  }

  get #isInvoked() {
    const { parent } = this.#member
    return (parent?.type === "CallExpression" && parent.callee === this.#member)
      || (parent?.type === "TaggedTemplateExpression" && parent.tag === this.#member)
  }
}

class ReceiverMember {
  #members

  constructor(receiver, property, { before = null, members }) {
    this.before = before
    this.receiver = receiver
    this.property = property
    this.#members = members
  }

  get isObject() {
    return this.receiver.type === "ObjectExpression"
  }

  get name() {
    return this.property.pathMember ?? this.property.name
  }

  get functionNode() {
    return this.isExact ? this.#members.functionFor(this) : null
  }

  get isExact() {
    return this.#members.isValidProperty(this.property)
      && (!this.isPrivate || classDeclaringPrivate(this.property.node) === this.receiver)
  }

  get isPrivate() {
    return this.property.kind === "private" || this.property.node?.type === "PrivateIdentifier"
  }

  get safeFunctionNode() {
    return this.isExact ? this.#members.safeFunctionFor(this) : null
  }

  get isSafeWrite() {
    return this.isStableData && !this.isCallable
  }

  get isStableData() {
    return this.isExact && this.#members.isStableData(this)
  }

  get isCallable() {
    return this.isExact && this.#members.isCallable(this)
  }

  get isSafeRead() {
    return this.isExact && this.#members.isSafeRead(this)
  }
}

class ReceiverSafetyStates {
  #final = new WeakMap()
  #initialization = new WeakMap()

  at(before) {
    return before ? this.#initializationAt(before) : this.#final
  }

  #initializationAt(before) {
    if (!this.#initialization.has(before)) this.#initialization.set(before, new WeakMap())
    return this.#initialization.get(before)
  }
}
