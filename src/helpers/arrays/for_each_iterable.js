import { ArrayEvidence } from "#helpers/arrays/array_evidence"
import {
  iteratorPrototypeChainNamesFor,
  iteratorPrototypeIntrinsicNameFor
} from "#helpers/arrays/iterator_intrinsic_path"
import { StandardGlobals } from "#helpers/scope/standard_globals"
import { ReceiverEvaluation } from "#helpers/flow/receiver_evaluation"

const ARRAY_ANALYSES = new WeakMap()

export class ForEachIterable {
  #array
  #bindings
  #node
  #set
  #arrayIteration

  constructor(node, sourceCode) {
    const arrays = arrayAnalysisFor(sourceCode)
    this.#array = arrays.valueOf(node)
    this.#arrayIteration = new NativeIteration("Array", arrays.globals)
    this.#bindings = arrays.bindings
    this.#node = node
    this.#set = new SetValue(node, arrays)
  }

  canUseForEachIn(loop) {
    return this.#isAvailableAtUse && new ReceiverEvaluation(this.#node, this.#bindings).isSafe
      && ((this.#array.canUseForEachIn(loop) && this.#arrayIteration.isExactAt(loop))
        || this.#set.canUseForEachIn(loop))
  }

  get isFreshForEachSource() {
    return this.#array.isFreshAndDense || this.#set.isFresh
  }

  get #isAvailableAtUse() {
    return this.#node.type !== "Identifier" || this.#bindings.stableValueFor(this.#node) !== null
  }
}

function arrayAnalysisFor(sourceCode) {
  if (!ARRAY_ANALYSES.has(sourceCode)) ARRAY_ANALYSES.set(sourceCode, new ArrayEvidence(sourceCode))
  return ARRAY_ANALYSES.get(sourceCode)
}

class NativeIteration {
  #globalName
  #globals

  constructor(globalName, globals) {
    this.#globalName = globalName
    this.#globals = globals
  }

  isExactAt(target) {
    return this.#globals.isIntrinsicUnmodifiedAt(target, this.#globalName, [ "prototype", "forEach" ])
      && this.#globals.isIntrinsicUnmodifiedAt(target, this.#globalName, [ "prototype", Symbol.iterator ])
      && this.#globals.isIntrinsicUnmodifiedAt(target, iteratorPrototypeIntrinsicNameFor(this.#globalName), [ "next" ])
      && iteratorPrototypeChainNamesFor(this.#globalName).every((prototypeName) =>
        this.#globals.isAbsentAndUnmodifiedAt(target, prototypeName, [ "return" ]))
  }
}

class SetValue {
  #bindings
  #cachedBinding
  #iteration
  #node
  #standardGlobals

  constructor(node, arrays) {
    this.#bindings = arrays.bindings
    this.#iteration = new NativeIteration("Set", arrays.globals)
    this.#node = node
    this.#standardGlobals = new StandardGlobals(arrays.bindings)
  }

  canUseForEachIn(loop) {
    return this.#iteration.isExactAt(loop) && (this.isFresh || this.#canUseBoundSetIn(loop))
  }

  get isFresh() {
    return this.#node.type === "NewExpression" && this.#standardGlobals.matches(this.#node.callee, "Set")
  }

  #canUseBoundSetIn(loop) {
    return this.#isBoundIdentifierToSet && this.#binding.references.every((reference) =>
      reference.init || reference.identifier === this.#node || reference.identifier.range[0] > loop.range[1])
  }

  get #isBoundIdentifierToSet() {
    return this.#node.type === "Identifier"
      && !this.#bindings.isDynamicallyResolved(this.#node)
      && this.#isBoundToSet
  }

  get #isBoundToSet() {
    return this.#definition?.type === "Variable"
      && this.#definition.parent.kind === "const"
      && Boolean(this.#definition.node.init)
      && this.#definition.node.init.type === "NewExpression"
      && this.#standardGlobals.matches(this.#definition.node.init.callee, "Set")
  }

  get #definition() {
    return this.#binding?.defs.length === 1 ? this.#binding.defs[0] : null
  }

  get #binding() {
    return this.#cachedBinding ??= this.#bindings.variableFor(this.#node)
  }
}
