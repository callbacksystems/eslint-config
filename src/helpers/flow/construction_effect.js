import { isClassNode } from "#helpers/syntax/classes"
import { isFunction, ownReturnArguments } from "#helpers/syntax/functions"

const NO_EFFECT = { executions: [], functions: [], isUnknown: false }

export class ConstructionEffect {
  #bindings
  #classes = new WeakMap()
  #classExecutions = new WeakMap()
  #freshReceivers = new WeakMap()
  #receiverPreservations = new WeakMap()
  #superExecutions = new WeakMap()
  #targetExecutions = new WeakMap()

  constructor(bindings) {
    this.#bindings = bindings
  }

  executionAt(node, { classNode = null } = {}) {
    return node.type === "NewExpression" ? this.#newExecutionOf(node.callee) : this.#superExecutionOf(classNode)
  }

  classExecutionOf(classNode) {
    if (!this.#classExecutions.has(classNode)) {
      this.#classExecutions.set(classNode, this.#withReceiverModes(this.#classOf(classNode).execution))
    }
    return this.#classExecutions.get(classNode)
  }

  #newExecutionOf(callee) {
    const target = this.#targetOf(callee)
    return target ? this.#executionOf(target) : NO_EFFECT
  }

  #targetOf(callee) {
    if (isClassNode(callee) || isFunction(callee)) return callee
    if (callee?.type !== "Identifier") return null

    return this.#bindings.classFor(callee) ?? this.#bindings.functionFor(callee)
  }

  #executionOf(target) {
    if (!this.#targetExecutions.has(target)) {
      const execution = isClassNode(target) || isConstructibleFunction(target)
        ? new ExecutionEffect([ target ], { hasFreshReceiverFor: () => isConstructibleFunction(target) })
        : NO_EFFECT
      this.#targetExecutions.set(target, execution)
    }
    return this.#targetExecutions.get(target)
  }

  #superExecutionOf(classNode) {
    if (classNode) {
      if (!this.#superExecutions.has(classNode)) {
        this.#superExecutions.set(classNode, this.#withReceiverModes(this.#classOf(classNode).superExecution))
      }
      return this.#superExecutions.get(classNode)
    } else {
      return ExecutionEffect.unknown()
    }
  }

  #withReceiverModes(effect) {
    return new ExecutionEffect(effect.functions, {
      isUnknown: effect.isUnknown,
      hasFreshReceiverFor: (functionNode) => this.#hasFreshReceiverFor(functionNode)
    })
  }

  #hasFreshReceiverFor(functionNode) {
    const classNode = classOfInstanceInitializer(functionNode)
    return classNode ? this.#freshReceiverOf(classNode) : isConstructibleFunction(functionNode)
  }

  #freshReceiverOf(classNode) {
    if (!this.#freshReceivers.has(classNode)) {
      const localClass = this.#classOf(classNode)
      const isFresh = !localClass.hasHeritage
        || (Boolean(localClass.superTarget) && this.#isReceiverPreservedBy(localClass.superTarget))
      this.#freshReceivers.set(classNode, isFresh)
    }
    return this.#freshReceivers.get(classNode)
  }

  #classOf(classNode) {
    if (!this.#classes.has(classNode)) {
      this.#classes.set(classNode, new LocalClassConstruction(classNode, this.#targetOf(classNode.superClass)))
    }
    return this.#classes.get(classNode)
  }

  #isReceiverPreservedBy(target) {
    return new ReceiverPreservation(target, {
      cache: this.#receiverPreservations,
      classFor: (classNode) => this.#classOf(classNode)
    }).isPreserved
  }
}

function isConstructibleFunction(functionNode) {
  return isFunction(functionNode) && functionNode.type !== "ArrowFunctionExpression"
    && !functionNode.async && !functionNode.generator
}

class ExecutionEffect {
  static unknown() {
    return new ExecutionEffect([], { isUnknown: true })
  }

  constructor(functions = [], { hasFreshReceiverFor = () => false, isUnknown = false } = {}) {
    this.executions = functions.map((functionNode) => ({
      functionNode,
      hasFreshReceiver: hasFreshReceiverFor(functionNode)
    }))
    this.functions = functions
    this.isUnknown = isUnknown
  }
}

function classOfInstanceInitializer(functionNode) {
  const member = functionNode?.type === "PropertyDefinition" ? functionNode : functionNode?.parent
  return isInstanceInitializer(member) ? member.parent.parent : null
}

function isInstanceInitializer(member) {
  return Boolean(member) && !member.static
    && (member.type === "PropertyDefinition" || member.kind === "constructor")
}

class LocalClassConstruction {
  superTarget = null

  #classNode
  #fields
  #initializerFunction

  constructor(classNode, superTarget) {
    this.#classNode = classNode
    this.#fields = instanceFieldsOf(classNode)
    this.#initializerFunction = constructorOf(classNode)
    this.superTarget = superTarget
  }

  get execution() {
    return this.#hasDerivedInitializer
      ? new ExecutionEffect([ this.#initializerFunction ])
      : new ExecutionEffect(this.#implicitExecutions, { isUnknown: this.hasOpaqueHeritage })
  }

  get hasOpaqueHeritage() {
    return this.hasHeritage && !this.superTarget
  }

  get hasHeritage() {
    return Boolean(this.#classNode.superClass)
  }

  get preservesOwnReceiver() {
    return !this.#initializerFunction || ownReturnArguments(this.#initializerFunction).length === 0
  }

  get superExecution() {
    return this.hasHeritage
      ? new ExecutionEffect([ ...this.#fields, this.superTarget ].filter(Boolean), {
        isUnknown: this.hasOpaqueHeritage
      })
      : ExecutionEffect.unknown()
  }

  get #hasDerivedInitializer() {
    return this.hasHeritage && Boolean(this.#initializerFunction)
  }

  get #implicitExecutions() {
    return [ ...this.#fields, this.#initializerFunction, this.#implicitSuperTarget ].filter(Boolean)
  }

  get #implicitSuperTarget() {
    return this.#initializerFunction ? null : this.superTarget
  }
}

function instanceFieldsOf(classNode) {
  return classNode.body.body.filter((member) => member.type === "PropertyDefinition" && !member.static && member.value)
}

function constructorOf(classNode) {
  return classNode.body.body.find((member) => member.type === "MethodDefinition"
    && member.kind === "constructor" && !member.static)?.value ?? null
}

class ReceiverPreservation {
  #cache
  #classFor
  #current
  #isPreserved = null
  #pending = []
  #visited = new Set()

  constructor(target, { cache, classFor }) {
    this.#current = target
    this.#cache = cache
    this.#classFor = classFor
  }

  get isPreserved() {
    while (this.#isPreserved === null) this.#advance()
    return this.#isPreserved
  }

  #advance() {
    if (!this.#current) this.#finishWith(true)
    else if (this.#cache.has(this.#current)) this.#finishWith(this.#cache.get(this.#current))
    else if (this.#visited.has(this.#current)) this.#finishWith(false)
    else this.#followCurrent()
    if (this.#isPreserved !== null) this.#cacheResult()
  }

  #finishWith(value) {
    this.#isPreserved = value
  }

  #followCurrent() {
    this.#visited.add(this.#current)
    this.#pending.push(this.#current)
    const step = new ReceiverPreservationStep(this.#current, this.#classFor)
    this.#isPreserved = step.isPreserved ? null : false
    this.#current = step.next
  }

  #cacheResult() {
    this.#pending.forEach((target) => this.#cache.set(target, this.#isPreserved))
  }
}

class ReceiverPreservationStep {
  #classFor
  #target

  constructor(target, classFor) {
    this.#target = target
    this.#classFor = classFor
  }

  get isPreserved() {
    return this.#isClass
      ? this.#class.preservesOwnReceiver && !this.#class.hasOpaqueHeritage
      : this.#isFunctionPreserved
  }

  get next() {
    return this.#isClass ? this.#class.superTarget : null
  }

  get #isClass() {
    return isClassNode(this.#target)
  }

  get #class() {
    return this.#classFor(this.#target)
  }

  get #isFunctionPreserved() {
    return isConstructibleFunction(this.#target) && ownReturnArguments(this.#target).length === 0
  }
}
