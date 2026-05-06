import { ArrayCall } from "#helpers/arrays/array_call"
import { ArrayCallback } from "#helpers/arrays/array_callback"
import { readReferences } from "#helpers/syntax/ast"
import { CallArguments } from "#helpers/functions/call_arguments"
import { enclosingClass, isClassMember, isClassNode, isThisMember, staticMemberKeyOf } from "#helpers/syntax/classes"
import { enclosingFunction, hasOwnArgumentsAccess } from "#helpers/syntax/functions"
import { LandingEvaluation } from "#helpers/flow/landing_evaluation"
import { LocalFunctionCalls } from "#helpers/functions/local_function_calls"
import { MemberAccess } from "#helpers/classes/member_access"

const DIRECT_CARRIERS = new Set([ "ConditionalExpression", "LogicalExpression", "ChainExpression" ])
const CONTAINER_WRAPPERS = new Set([ "Property", "SpreadElement" ])

export function staysAt(node, view, flow) {
  return new Landing(node, view, flow).staysHere
}

export function keepsClassUse(identifier, view) {
  return new ClassUse(identifier, view).staysHere
}

class Landing {
  #view
  #evaluation

  constructor(node, view, { evaluation = new LandingEvaluation(), containerKind = null } = {}) {
    this.node = node
    this.#view = view
    this.#evaluation = evaluation
    this.containerKind = containerKind
  }

  get staysHere() {
    return this.#evaluation.keeps(this)
  }

  get isImmediatelyKept() {
    return this.#landsHere
  }

  get #landsHere() {
    const { parent } = this.node
    if (!parent) return false
    if (DIRECT_CARRIERS.has(parent.type)) return this.#isCarriedBy(parent)

    const containerKind = containerKindIn(parent, this.containerKind)
    return containerKind ? this.#isCarriedBy(parent, { containerKind }) : this.#landsIn(parent)
  }

  #isCarriedBy(node, { containerKind = this.containerKind } = {}) {
    return new Landing(node, this.#view, { evaluation: this.#evaluation, containerKind }).staysHere
  }

  #landsIn(parent) {
    return this.#flowLandingIn(parent) ?? this.#isKeptInStructure(parent)
  }

  #flowLandingIn(parent) {
    switch (parent.type) {
      case "VariableDeclarator": return this.#staysThroughVariable(parent)
      case "CallExpression": return this.#staysThroughCall(parent)
      case "ReturnStatement": return this.#staysReturnedFrom(enclosingFunction(parent))
      case "ArrowFunctionExpression": return parent.body === this.node && this.#staysReturnedFrom(parent)
      default: return null
    }
  }

  #staysThroughVariable(declarator) {
    if (declarator.id.type !== "Identifier") return false
    if (this.#view.isExportedDeclaration(declarator)) return false

    return readReferences(this.#view.sourceCode, declarator)
      .every((reference) => this.#landingAt(reference.identifier).staysHere)
  }

  #landingAt(node) {
    return new Landing(node, this.#view, { evaluation: this.#evaluation, containerKind: this.containerKind })
  }

  #staysThroughCall(call) {
    return call.callee === this.node ? this.#staysAsCallReceiver(call) : this.#staysAsCallArgument(call)
  }

  #staysAsCallReceiver(call) {
    const flow = new ArrayFlow(this.#view, this.#landingFlow)
    return this.containerKind === "array" && new ArrayCall(call, flow).staysHere
  }

  get #landingFlow() {
    return { evaluation: this.#evaluation, containerKind: this.containerKind }
  }

  #staysAsCallArgument(call) {
    const position = new CallArguments(call).stablePositionOf(this.node)
    return position === -1 ? false : this.#isArgumentKeptBy(call, position)
  }

  #isArgumentKeptBy(call, position) {
    const functionNode = call.callee.type === "Identifier" ? this.#view.functionFor(call.callee) : null
    return this.#isParameterKept(functionNode, position)
  }

  #isParameterKept(functionNode, position) {
    const parameter = this.#view.parameterAt(functionNode, position)
    return Boolean(parameter) && !hasOwnArgumentsAccess(functionNode, this.#view.sourceCode)
      && parameter.references.filter((reference) => reference.isRead())
        .every((reference) => this.#landingAt(reference.identifier).staysHere)
  }

  #staysReturnedFrom(functionNode) {
    return Boolean(functionNode) && new Producer(functionNode, this.#view, this.#landingFlow).keepsReturns
  }

  #isKeptInStructure(parent) {
    switch (parent.type) {
      case "ExpressionStatement": return true
      case "MemberExpression": return this.#staysThroughMember(parent)
      case "AssignmentExpression": return this.#staysThroughAssignment(parent)
      case "PropertyDefinition": return this.#staysInField(parent)
      case "NewExpression": return this.#staysAsConstructorArgument(parent)
      default: return false
    }
  }

  #staysThroughMember(member) {
    return member.object === this.node && (this.containerKind
      ? this.#staysThroughContainerMember(member)
      : Boolean(staticMemberKeyOf(member)))
  }

  #staysThroughContainerMember(member) {
    const access = new MemberAccess(member)
    return this.#isArrayContainer && access.isLengthRead
      ? true
      : this.#isCarriedBy(member, { containerKind: access.isCalled ? this.containerKind : null })
  }

  get #isArrayContainer() {
    return this.containerKind === "array"
  }

  #staysThroughAssignment(assignment) {
    return assignment.right === this.node && isThisMember(assignment.left)
      && new MemberStorage(assignment.left, this.#view, this.#landingFlow).staysHere
      && this.#isCarriedBy(assignment)
  }

  #staysInField(field) {
    return new MemberStorage(field, this.#view, this.#landingFlow).staysHere
  }

  #staysAsConstructorArgument(expression) {
    const position = new CallArguments(expression).stablePositionOf(this.node)
    return position === -1 || expression.callee.type !== "Identifier"
      ? false
      : this.#isConstructorArgumentKept(this.#view.classFor(expression.callee), position)
  }

  #isConstructorArgumentKept(classNode, position) {
    if (classNode && !classNode.superClass) {
      const constructorMethod = classNode.body.body
        .find((member) => member.type === "MethodDefinition" && member.kind === "constructor")
      return !constructorMethod || this.#isParameterKept(constructorMethod.value, position)
    } else {
      return false
    }
  }
}

function containerKindIn(parent, carriedKind) {
  if (parent.type === "ArrayExpression") return "array"
  if (parent.type === "ObjectExpression") return "object"

  return CONTAINER_WRAPPERS.has(parent.type) ? carriedKind ?? "unknown" : null
}

class ArrayFlow {
  #view
  #flow

  constructor(view, flow) {
    this.#view = view
    this.#flow = flow
  }

  functionFor(identifier) {
    return this.#view.functionFor(identifier)
  }

  get sourceCode() {
    return this.#view.sourceCode
  }

  keepsParameter(callback, { position, containerKind }) {
    const restPosition = callback.params.findIndex((parameter) => parameter.type === "RestElement")
    if (restPosition !== -1 && restPosition <= position) return false

    const variable = this.#view.parameterAt(callback, position)
    return position >= callback.params.length || (Boolean(variable)
      && variable.references.filter((reference) => reference.isRead()).every((reference) => new Landing(
        reference.identifier, this.#view, { evaluation: this.#flow.evaluation, containerKind }
      ).staysHere))
  }

  keepsResult(call, containerKind) {
    return new Landing(call, this.#view, { evaluation: this.#flow.evaluation, containerKind }).staysHere
  }
}

class Producer {
  #node
  #view
  #flow
  #cachedArrayCallback

  constructor(node, view, flow) {
    this.#node = node
    this.#view = view
    this.#flow = flow
  }

  get keepsReturns() {
    if (this.#arrayCallback.isConsuming) return true
    if (this.#arrayCallback.isMapping) return this.#resultLanding.staysHere
    if (this.#isLocalFunction) return this.#isLocalFunctionReturnKept
    if (this.#isMember) return this.#isMemberReturnKept

    return false
  }

  get #arrayCallback() {
    return this.#cachedArrayCallback ??= new ArrayCallback(this.#node, this.#view.sourceCode)
  }

  get #resultLanding() {
    const containerKind = this.#arrayCallback.isArrayMapping ? "array" : null
    return new Landing(this.#arrayCallback.invocation, this.#view, { evaluation: this.#flow.evaluation, containerKind })
  }

  get #isLocalFunction() {
    return this.#node.type === "FunctionDeclaration" || this.#node.parent?.type === "VariableDeclarator"
  }

  get #isLocalFunctionReturnKept() {
    const calls = new LocalFunctionCalls(this.#node, this.#view).values
    return calls !== null && calls.every((call) => this.#landingAt(call).staysHere)
  }

  #landingAt(node) {
    return new Landing(node, this.#view, { evaluation: this.#flow.evaluation, containerKind: this.#flow.containerKind })
  }

  get #isMember() {
    return isClassMember(this.#node.parent)
  }

  get #isMemberReturnKept() {
    const member = this.#node.parent
    return this.#view.keepsInstancesOf(member.parent.parent) && this.#memberReadsOf(member)
      .every((node) => this.#callLandingFor(node)?.staysHere)
  }

  #memberReadsOf(member) {
    return this.#view.memberReadsFor(member, { owner: member.parent.parent, isStatic: member.static })
  }

  #callLandingFor(callee) {
    const node = this.#landingNodeFor(callee)
    return node ? this.#landingAt(node) : null
  }

  #landingNodeFor(callee) {
    if (isCallCallee(callee)) return callee.parent
    return this.#node.parent?.kind === "method" ? null : callee
  }
}

function isCallCallee(callee) {
  return callee.parent?.type === "CallExpression" && callee.parent.callee === callee
}

class MemberStorage {
  #member
  #view
  #flow
  #owner

  constructor(member, view, flow) {
    this.#member = member
    this.#view = view
    this.#flow = flow
    this.#owner = member.type === "PropertyDefinition"
      ? enclosingClass(member)
      : view.instanceClassOf(member.object)
  }

  get staysHere() {
    return Boolean(this.#key) && Boolean(this.#owner) && this.#view.keepsInstancesOf(this.#owner)
      && this.#reads.every((node) => new Landing(node, this.#view, this.#flow).staysHere)
  }

  get #key() {
    return staticMemberKeyOf(this.#member)
  }

  get #reads() {
    return this.#view.memberReadsFor(this.#member, {
      owner: this.#owner,
      isStatic: this.#member.type === "PropertyDefinition" && this.#member.static
    }).filter((node) => node !== this.#member)
  }
}

// A class passed around as a value could be built anywhere. A local subclass is safe only when its instances are too.
class ClassUse {
  #identifier
  #view

  constructor(identifier, view) {
    this.#identifier = identifier
    this.#view = view
  }

  get staysHere() {
    if (this.#isConstruction) return new Landing(this.#identifier.parent, this.#view).staysHere
    if (this.#isSuperclass) return this.#view.keepsInstancesOf(this.#identifier.parent)
    return this.#isMemberReceiver
  }

  get #isConstruction() {
    const { parent } = this.#identifier
    return parent.type === "NewExpression" && parent.callee === this.#identifier
  }

  get #isSuperclass() {
    const { parent } = this.#identifier
    return isClassNode(parent) && parent.superClass === this.#identifier
  }

  get #isMemberReceiver() {
    const { parent } = this.#identifier
    return parent.type === "MemberExpression" && parent.object === this.#identifier
  }
}
