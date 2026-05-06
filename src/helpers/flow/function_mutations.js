import { isFunction } from "#helpers/syntax/functions"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { CalleeResolver } from "#helpers/scope/callee_resolver"
import { ConstructionEffect } from "#helpers/flow/construction_effect"
import { DirectMutation } from "#helpers/flow/direct_mutation"
import { FunctionEffectGraph } from "#helpers/flow/function_effect_graph"
import { FunctionExecutionContexts } from "#helpers/flow/function_execution_contexts"
import { ImplicitCalls } from "#helpers/flow/implicit_calls"
import { StandardPureCall } from "#helpers/flow/standard_pure_call"
import { ThisDispatch } from "#helpers/flow/this_dispatch"
import { isMemberRead } from "#helpers/classes/member_write_targets"
import { enclosingClass, isClassNode, isThisMember } from "#helpers/syntax/classes"

const INVOCATION_TYPES = new Set([ "CallExpression", "NewExpression", "TaggedTemplateExpression" ])

export class FunctionMutations {
  #calls = new WeakMap()
  #constructions
  #effects = new FunctionEffectGraph()
  #indexedClasses = new WeakSet()
  #indexedFields = new WeakSet()
  #mutating
  #unknown
  #policy
  #resolver
  #services
  #bindings

  constructor(sourceCode, options = {}) {
    this.#policy = new MutationPolicy(options)
    this.#resolver = new CalleeResolver(sourceCode)
    this.#bindings = BindingResolver.for(sourceCode)
    this.#constructions = new ConstructionEffect(this.#bindings)
    const dispatch = new ThisDispatch(sourceCode, { bindings: this.#bindings, resolver: this.#resolver })
    this.#services = new EffectServices({
      dispatch,
      effectOf: (functionNode) => this.#effectOf(functionNode),
      executionAt: (context) => this.#executionAt(context),
      implicitCalls: new ImplicitCalls(sourceCode, this.#bindings),
      resolver: this.#resolver
    })
    new FunctionExecutionContexts(sourceCode.ast).forEach((context) => this.add(context))
    this.#mutating = this.#effects.mutatingFunctions
    this.#unknown = this.#effects.unknownFunctions
  }

  add(context) {
    this.#policy.inspectContext?.(context)
    if (context.functionNode) this.#addEffect(context)
  }

  isPureFrom(functionNode) {
    return !this.mutatesFrom(functionNode) && !this.hasUnknownFrom(functionNode)
  }

  mutatesFrom(functionNode) {
    return this.#mutating.has(functionNode)
  }

  hasUnknownFrom(functionNode) {
    return this.#unknown.has(functionNode)
  }

  isPureFromCall(node) {
    return !this.mutatesFromCall(node) && !this.hasUnknownFromCall(node)
  }

  mutatesFromCall(node) {
    return this.#callFor(node).mutatesWith(this.#mutating)
  }

  hasUnknownFromCall(node) {
    return this.#callFor(node).isUnknownWith(this.#unknown)
  }

  #effectOf(functionNode) {
    return this.#effects.effectsOf(functionNode)
  }

  #executionAt(context) {
    const { node } = context
    return node.type === "NewExpression" || calleeOf(node).type === "Super"
      ? this.#constructionFor(node, enclosingClass(context.functionNode))
      : this.#callFor(node)
  }

  #constructionFor(node, classNode) {
    return this.#indexedConstruction(this.#constructions.executionAt(node, { classNode }))
  }

  #indexedConstruction(construction) {
    construction.executions.forEach(({ functionNode }) => this.#indexConstruction(functionNode))
    return construction
  }

  #indexConstruction(execution) {
    if (isClassNode(execution)) this.#indexClass(execution)
    else this.#indexField(execution)
  }

  #indexClass(classNode) {
    if (!this.#indexedClasses.has(classNode)) {
      this.#indexedClasses.add(classNode)
      const construction = this.#constructions.classExecutionOf(classNode)
      this.#services.addConstruction(this.#effectOf(classNode), construction)
      construction.executions.forEach(({ functionNode }) => this.#indexConstruction(functionNode))
    }
  }

  #indexField(execution) {
    if (execution.type === "PropertyDefinition" && !this.#indexedFields.has(execution)) {
      this.#indexedFields.add(execution)
      this.#effectOf(execution)
      new FunctionExecutionContexts(execution.value).forEach((context) => {
        if (!context.functionNode) this.#addEffect(context, execution)
      })
    }
  }

  #addEffect(context, functionNode = context.functionNode) {
    const effectContext = functionNode === context.functionNode
      ? context
      : { node: context.node, functionNode }
    const entry = new EffectEntry(effectContext, {
      bindings: this.#bindings,
      effects: this.#effectOf(functionNode),
      policy: this.#policy,
      services: this.#services
    })
    entry.add()
  }

  #callFor(node) {
    if (!this.#calls.has(node)) {
      this.#calls.set(node, new CallEffect(node, {
        bindings: this.#bindings,
        dispatch: this.#services.dispatch,
        resolver: this.#resolver
      }))
    }
    return this.#calls.get(node)
  }
}

class MutationPolicy {
  constructor({ inspectContext = null, isAdditionalEffect = null, memberWrites = "all" } = {}) {
    this.inspectContext = inspectContext
    this.isAdditionalEffect = isAdditionalEffect
    this.memberWrites = memberWrites
  }
}

class EffectServices {
  constructor({ dispatch, effectOf, executionAt, implicitCalls, resolver }) {
    this.dispatch = dispatch
    this.effectOf = effectOf
    this.executionAt = executionAt
    this.implicitCalls = implicitCalls
    this.resolver = resolver
  }

  addConstruction(effects, construction) {
    if (construction.isUnknown) effects.markUnknown()
    construction.executions.forEach(({ functionNode, hasFreshReceiver }) => {
      const callee = this.effectOf(functionNode).forReceiver(hasFreshReceiver)
      effects.normal.addFunction(callee)
      effects.fresh.addFunction(callee)
    })
  }
}

function calleeOf(node) {
  return node.type === "TaggedTemplateExpression" ? node.tag : node.callee
}

class EffectEntry {
  #direct
  #effects
  #services

  constructor(context, { bindings, effects, policy, services }) {
    this.context = context
    this.#effects = effects
    this.#services = services
    this.#direct = new DirectMutation(context, { bindings, policy })
  }

  add() {
    this.#addDirectEffects()
    this.#addExecutedFunction()
  }

  #addDirectEffects() {
    this.#effects.addBindingMutation(this.#direct.bindingMutation)
    this.#effects.normal.addDirect(this.#direct)
    this.#effects.fresh.addDirect(this.#direct.freshReceiverResult)
  }

  #addExecutedFunction() {
    const { node } = this.context
    if (isInvocation(node)) this.#addExecution()
    else if (node.type === "MemberExpression" && isMemberRead(node)) this.#addReceiverRead(node)
    if (this.#services.implicitCalls.areUnknownAt(node)) this.#effects.markUnknown()
    this.#direct.receiverWriteTargets.forEach((target) => this.#addReceiverWrite(target))
  }

  #addExecution() {
    const execution = this.#services.executionAt(this.context)
    if (execution instanceof CallEffect) this.#addCall(execution)
    else this.#services.addConstruction(this.#effects, execution)
  }

  #addCall(call) {
    if (call.isUnknown) this.#effects.markUnknown()
    call.functions.forEach((functionNode) => this.#addCalledFunction(functionNode, call))
    if (call.isFreshReceiverUnknown) this.#effects.fresh.isDirectlyUnknown = true
  }

  #addCalledFunction(functionNode, call) {
    const callee = this.#services.effectOf(functionNode)
    this.#effects.normal.addFunction(callee.normal)
    this.#effects.fresh.addFunction(call.forwardsFreshReceiver ? callee.fresh : callee.normal)
  }

  #addReceiverRead(member) {
    const getter = this.#services.resolver.getterResolutionFor(member)
    if (getter.functionNode) this.#addReceiverFunction(getter.functionNode, member)
    else {
      const isInexactThis = isThisMember(member) && !this.#isDispatchExactFor(member)
      if (isInexactThis || getter.isUnknown) this.#effects.markUnknown()
      else if (!isThisMember(member)) this.#markFreshUnknown()
    }
  }

  #addReceiverFunction(functionNode, member) {
    const callee = this.#services.effectOf(functionNode)
    this.#effects.normal.addFunction(callee.normal)
    if (this.#isDispatchExactFor(member)) this.#effects.fresh.addFunction(callee.fresh)
    else this.#effects.markUnknown()
  }

  #isDispatchExactFor(member) {
    return this.#services.dispatch.isExactFor(member)
  }

  #markFreshUnknown() {
    this.#effects.fresh.isDirectlyUnknown = true
  }

  #addReceiverWrite(member) {
    if (this.#services.resolver.isClassReceiverFor(member)) {
      if (this.#isDispatchExactFor(member)) this.#addSetter(member)
      else this.#markFreshUnknown()
    } else this.#markFreshUnknown()
  }

  #addSetter(member) {
    const setter = this.#services.resolver.setterResolutionFor(member)
    if (setter.isUnknown) this.#markFreshUnknown()
    else if (setter.functionNode) this.#addReceiverFunction(setter.functionNode, member)
  }
}

function isInvocation(node) {
  return INVOCATION_TYPES.has(node.type)
}

class CallEffect {
  #bindings
  #callee
  #calleeNode
  #dispatch
  #node

  constructor(node, { bindings, dispatch, resolver }) {
    this.#bindings = bindings
    this.#calleeNode = calleeOf(node)
    this.#callee = resolver.functionFor(this.#calleeNode) ?? inlineCalleeOf(this.#calleeNode)
    this.#dispatch = dispatch
    this.#node = node
    this.functions = this.#functions
    this.forwardsFreshReceiver = this.#isExactDispatch
    this.isFreshReceiverUnknown = this.#isInexactThisDispatch
    this.isUnknown = this.#isInexactThisDispatch || (!this.#callee && !this.#isStandardPureCall)
  }

  mutatesWith(functions) {
    return this.functions.some((callee) => functions.has(callee))
  }

  isUnknownWith(functions) {
    return this.isUnknown || this.functions.some((callee) => functions.has(callee))
  }

  get #functions() {
    return this.#callee && !this.#callee.generator ? [ this.#callee ] : []
  }

  get #isExactDispatch() {
    return isThisMember(this.#calleeNode) && this.#dispatch.isExactFor(this.#calleeNode)
  }

  get #isInexactThisDispatch() {
    return isThisMember(this.#calleeNode) && !this.#isExactDispatch
  }

  get #isStandardPureCall() {
    return this.#node.type === "CallExpression" && new StandardPureCall(this.#node, this.#bindings).isPure
  }
}

function inlineCalleeOf(callee) {
  return isFunction(callee) ? callee : null
}
