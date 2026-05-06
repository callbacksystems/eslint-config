// Prove array origins without recursive descent: long `.map()`/alias chains are ordinary in generated code, while a
// cyclic declaration must conservatively resolve to false instead of overflowing the stack.

import { ConstantReference } from "#helpers/scope/constant_reference"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ResolutionCache } from "#helpers/scope/resolution_cache"
import { ReceiverIdentity } from "#helpers/scope/receiver_identity"
import { calleeMemberName } from "#helpers/syntax/classes"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"
import { NativeSplitResult } from "#helpers/arrays/native_split_result"

const ARRAY_METHODS = new Set([
  "concat", "filter", "flat", "flatMap", "map", "slice", "split", "toReversed", "toSorted", "toSpliced"
])
const DENSE_ARRAY_METHODS = new Set([ "filter", "flat", "flatMap", "toReversed", "toSorted", "toSpliced" ])
const ARRAY_SPECIES_METHODS = new Set([ "concat", "filter", "flat", "flatMap", "map", "slice" ])
const ARRAY_STATICS = { Array: new Set([ "from", "of" ]), Object: new Set([ "entries", "keys", "values" ]) }

export class ArrayEvidence {
  #facts
  #receivers

  constructor(sourceCode) {
    this.sourceCode = sourceCode
    this.bindings = BindingResolver.for(sourceCode)
    this.globals = new GlobalValueIdentity(this.bindings)
    this.#facts = new ArrayFacts(this)
  }

  valueOf(node) {
    return new ArrayValue(node, this)
  }

  isEvident(node) {
    return this.#facts.valueOf(EvidenceState.for(node, "evident"))
  }

  isDirect(node) {
    return this.#facts.valueOf(EvidenceState.for(node, "direct"))
  }

  isOwnMemberUnmodifiedAt(identifier, name, target) {
    return this.#receiverIdentity.hasUnmodifiedMemberAt(identifier, name, target)
  }

  get #receiverIdentity() {
    return this.#receivers ??= new ReceiverIdentity(this.sourceCode, this.bindings)
  }
}

class ArrayFacts {
  #analysis
  #cache

  constructor(analysis) {
    this.#analysis = analysis
    this.#cache = new ResolutionCache(this, false)
  }

  valueOf(state) {
    return this.#cache.valueFrom(state)
  }

  stepFrom(state) {
    return new ArrayEvidenceStep(state, this.#analysis).value
  }
}

class ArrayEvidenceStep {
  #state
  #analysis

  constructor(state, analysis) {
    this.#state = state
    this.#analysis = analysis
  }

  get value() {
    if (this.#state.node.type === "ArrayExpression") return ResolutionCache.final(true)
    if (new DirectArrayConstruction(this.#state.node, this.#analysis).isPresent) return ResolutionCache.final(true)
    if (this.#state.node.type === "CallExpression") return new ArrayOrigin(this.#state.node, this.#analysis).step
    if (this.#state.mode === "evident" && this.#state.node.type === "Identifier") return this.#identifierStep
    return ResolutionCache.final(false)
  }

  get #identifierStep() {
    const value = this.#analysis.bindings.isImmutableValue(this.#state.node)
      ? this.#analysis.bindings.stableValueFor(this.#state.node)
      : null
    return value
      ? ResolutionCache.following(EvidenceState.for(value, "direct"))
      : ResolutionCache.final(false)
  }
}

class DirectArrayConstruction {
  #analysis
  #node

  constructor(node, analysis) {
    this.#node = node
    this.#analysis = analysis
  }

  get isPresent() {
    return [ "CallExpression", "NewExpression" ].includes(this.#node.type)
      && this.#analysis.globals.matches(this.#node.callee, "Array")
  }
}

class ArrayOrigin {
  #node
  #analysis

  constructor(node, analysis) {
    this.#node = node
    this.#analysis = analysis
  }

  get step() {
    if (!this.#isPlainMember) return ResolutionCache.final(false)
    if (this.#isArrayStatic) return ResolutionCache.final(true)
    if (this.#isKnownArrayMethod) {
      return this.#method === "split"
        ? ResolutionCache.final(this.#isStringReceiver)
        : ResolutionCache.following(EvidenceState.for(this.#node.callee.object, "evident"))
    }
    return ResolutionCache.final(false)
  }

  get isDense() {
    return this.#isArrayStatic || (this.#isKnownArrayMethod && this.#isKnownDenseArrayMethod)
  }

  get #isPlainMember() {
    const { callee } = this.#node
    return !this.#node.optional && callee.type === "MemberExpression" && !callee.optional && Boolean(this.#method)
  }

  get #method() {
    return calleeMemberName(this.#node.callee) ?? ""
  }

  get #isArrayStatic() {
    if (!this.#isPlainMember || this.#node.callee.object.type !== "Identifier") return false

    const globalName = this.#analysis.bindings.globalNameFor(this.#node.callee.object)
    return Boolean(ARRAY_STATICS[globalName]?.has(this.#method))
      && this.#analysis.globals.matches(this.#node.callee, globalName, [ this.#method ])
  }

  get #isKnownArrayMethod() {
    return this.#isPlainMember && ARRAY_METHODS.has(this.#method)
      && this.#hasExactNativeMethod && this.#hasNativeArrayResult
  }

  get #hasExactNativeMethod() {
    return this.#analysis.globals.isIntrinsicUnmodifiedAt(
      this.#node.callee,
      this.#method === "split" ? "String" : "Array",
      [ "prototype", this.#method ]
    ) && this.#hasUnmodifiedOwnMethod
  }

  get #hasUnmodifiedOwnMethod() {
    const { object } = this.#node.callee
    return object.type !== "Identifier"
      || this.#analysis.isOwnMemberUnmodifiedAt(object, this.#method, this.#node.callee)
  }

  get #hasNativeArrayResult() {
    return this.#method === "split"
      ? new NativeSplitResult(this.#node, this.#analysis).isArray
      : !ARRAY_SPECIES_METHODS.has(this.#method) || this.#hasDefaultArraySpecies
  }

  get #hasDefaultArraySpecies() {
    return this.#analysis.globals.isIntrinsicUnmodifiedAt(this.#node, "Array", [ "prototype", "constructor" ])
      && this.#analysis.globals.isIntrinsicUnmodifiedAt(this.#node, "Array", [ Symbol.species ])
      && this.#analysis.globals.isIntrinsicUnmodifiedAt(this.#node, "Array",
        [ "prototype", "constructor", Symbol.species ])
      && this.#hasUnmodifiedOwnConstructor
  }

  get #hasUnmodifiedOwnConstructor() {
    const { object } = this.#node.callee
    return object.type !== "Identifier"
      || this.#analysis.isOwnMemberUnmodifiedAt(object, "constructor", this.#node)
  }

  get #isStringReceiver() {
    return new StringValue(this.#node.callee.object, this.#analysis.bindings).isEvident
  }

  get #isKnownDenseArrayMethod() {
    return this.#method === "split"
      ? this.#isStringReceiver
      : DENSE_ARRAY_METHODS.has(this.#method) && this.#analysis.isEvident(this.#node.callee.object)
  }
}

class EvidenceState {
  static #direct = new WeakMap()
  static #evident = new WeakMap()

  static for(node, mode) {
    const states = mode === "direct" ? this.#direct : this.#evident
    if (!states.has(node)) states.set(node, new EvidenceState(node, mode))
    return states.get(node)
  }

  constructor(node, mode) {
    this.node = node
    this.mode = mode
  }
}

class StringValue {
  #node
  #bindings

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
  }

  get isEvident() {
    return isStringIterable(this.#node) || (this.#node.type === "Identifier" && this.#isBoundToString)
  }

  get #isBoundToString() {
    const value = this.#bindings.isImmutableValue(this.#node)
      ? this.#bindings.stableValueFor(this.#node)
      : null
    return Boolean(value) && isStringIterable(value)
  }
}

function isStringIterable(node) {
  return node.type === "TemplateLiteral" || (node.type === "Literal" && typeof node.value === "string")
}

class ArrayValue {
  #node
  #analysis
  #cachedConstant

  constructor(node, analysis) {
    this.#node = node
    this.#analysis = analysis
  }

  canUseForEachIn(loop) {
    return this.isFreshAndDense || this.#canUseBoundArrayIn(loop)
  }

  get isFreshAndDense() {
    return this.#node.type === "ArrayExpression"
      ? this.#node.elements.every(Boolean)
      : this.#node.type === "CallExpression" && new ArrayOrigin(this.#node, this.#analysis).isDense
  }

  #canUseBoundArrayIn(loop) {
    return this.#isBoundToDenseArray && this.#constant.isOnlyReferenceBefore(loop)
  }

  get #isBoundToDenseArray() {
    const { initializer } = this.#constant
    return Boolean(initializer) && this.#analysis.isDirect(initializer)
      && this.#analysis.valueOf(initializer).isFreshAndDense
  }

  get #constant() {
    return this.#cachedConstant ??= new ConstantReference(this.#node, this.#analysis.bindings)
  }
}
