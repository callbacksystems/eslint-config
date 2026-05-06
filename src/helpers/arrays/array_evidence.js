// Prove array origins without recursive descent: long `.map()`/alias chains are ordinary in generated code, while a
// cyclic declaration must conservatively resolve to false instead of overflowing the stack.

import { BindingResolver } from "#helpers/scope/binding_resolver"
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
    this.bindings = new BindingResolver(sourceCode)
    this.globals = new GlobalValueIdentity(this.bindings)
    this.#facts = new ArrayFacts(this)
  }

  valueOf(node) {
    return new ArrayValue(node, this)
  }

  isEvident(node) {
    return this.#facts.valueOf(new EvidenceState(node, "evident"))
  }

  isDirect(node) {
    return this.#facts.valueOf(new EvidenceState(node, "direct"))
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
  #direct = new WeakMap()
  #evident = new WeakMap()

  constructor(analysis) {
    this.#analysis = analysis
  }

  valueOf(state) {
    return new EvidenceWalk(state, this, this.#analysis).value
  }

  has(state) {
    return this.#valuesFor(state).has(state.node)
  }

  get(state) {
    return this.#valuesFor(state).get(state.node)
  }

  set(state, value) {
    this.#valuesFor(state).set(state.node, value)
  }

  #valuesFor(state) {
    return state.mode === "direct" ? this.#direct : this.#evident
  }
}

class EvidenceWalk {
  #state
  #facts
  #analysis
  #path = []
  #seenDirect = new WeakSet()
  #seenEvident = new WeakSet()

  constructor(state, facts, analysis) {
    this.#state = state
    this.#facts = facts
    this.#analysis = analysis
  }

  get value() {
    while (this.#canAdvance) {
      this.#rememberState()
      const step = new ArrayEvidenceStep(this.#state, this.#analysis).value
      if (step.isFinal) return this.#remember(step.result)

      this.#state = step.state
    }
    return this.#remember(this.#facts.has(this.#state) ? this.#facts.get(this.#state) : false)
  }

  get #canAdvance() {
    return !this.#facts.has(this.#state) && !this.#seen.has(this.#state.node)
  }

  get #seen() {
    return this.#state.mode === "direct" ? this.#seenDirect : this.#seenEvident
  }

  #rememberState() {
    this.#seen.add(this.#state.node)
    this.#path.push(this.#state)
  }

  #remember(value) {
    this.#path.forEach((state) => this.#facts.set(state, value))
    return value
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
    if (this.#state.node.type === "ArrayExpression") return EvidenceStep.final(true)
    if (new DirectArrayConstruction(this.#state.node, this.#analysis).isPresent) return EvidenceStep.final(true)
    if (this.#state.node.type === "CallExpression") return new ArrayOrigin(this.#state.node, this.#analysis).step
    if (this.#state.mode === "evident" && this.#state.node.type === "Identifier") return this.#identifierStep
    return EvidenceStep.final(false)
  }

  get #identifierStep() {
    const value = this.#analysis.bindings.isImmutableValue(this.#state.node)
      ? this.#analysis.bindings.stableValueFor(this.#state.node)
      : null
    return value
      ? EvidenceStep.following(new EvidenceState(value, "direct"))
      : EvidenceStep.final(false)
  }
}

class EvidenceStep {
  static final(result) {
    return new EvidenceStep({ result })
  }

  static following(state) {
    return new EvidenceStep({ state })
  }

  constructor({ result = false, state = null }) {
    this.result = result
    this.state = state
  }

  get isFinal() {
    return this.state === null
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
    if (!this.#isPlainMember) return EvidenceStep.final(false)
    if (this.#isArrayStatic) return EvidenceStep.final(true)
    if (this.#isKnownArrayMethod) {
      return this.#method === "split"
        ? EvidenceStep.final(this.#isStringReceiver)
        : EvidenceStep.following(new EvidenceState(this.#node.callee.object, "evident"))
    }
    return EvidenceStep.final(false)
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
  #cachedBinding

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
    return this.#isBoundIdentifierToDenseArray && this.#binding.references.every((reference) =>
      reference.init || reference.identifier === this.#node || reference.identifier.range[0] > loop.range[1])
  }

  get #isBoundIdentifierToDenseArray() {
    return this.#node.type === "Identifier"
      && !this.#analysis.bindings.isDynamicallyResolved(this.#node)
      && this.#isBoundToDenseArray
  }

  get #isBoundToDenseArray() {
    return this.#isBoundToArray && this.#analysis.valueOf(this.#definition.node.init).isFreshAndDense
  }

  get #isBoundToArray() {
    return this.#definition?.type === "Variable"
      && this.#definition.parent.kind === "const"
      && Boolean(this.#definition.node.init)
      && this.#analysis.isDirect(this.#definition.node.init)
  }

  get #definition() {
    return this.#binding?.defs.length === 1 ? this.#binding.defs[0] : null
  }

  get #binding() {
    return this.#cachedBinding ??= this.#analysis.bindings.variableFor(this.#node)
  }
}
