import { stableExpressionFor } from "#helpers/flow/stable_expression"
import { ExactIterationSource } from "#helpers/flow/exact_iteration_source"
import { NativeEvaluationInput } from "#helpers/flow/native_evaluation_input"

const ADDER_BY_GLOBAL = new Map([ [ "Map", "set" ], [ "Set", "add" ], [ "WeakMap", "set" ], [ "WeakSet", "add" ] ])
const DIRECT_OBJECT_TYPES = new Set([
  "ArrayExpression", "ArrowFunctionExpression", "FunctionExpression", "NewExpression", "ObjectExpression"
])

export class CollectionReceiverEvaluation {
  #context
  #globalName

  constructor(context) {
    this.#context = context
  }

  get matches() {
    return Boolean(this.#name)
  }

  get isSafe() {
    const [ source ] = this.#context.node.arguments
    if (!source || new NativeEvaluationInput(source, this.#context.bindings).isNullish) return true
    if (!this.#hasNativeAdder) return false
    if (this.#name === "Set") return this.#isExactSource
    if (this.#name === "WeakSet") return this.#isSafeWeakSetSource
    return new DirectMapEntries(source, { context: this.#context, withObjectKeys: this.#name === "WeakMap" }).isSafe
  }

  get #name() {
    return this.#globalName ??= ADDER_BY_GLOBAL.keys().find((name) =>
      this.#context.isNew && this.#context.globals.matches(this.#context.node.callee, name)) ?? null
  }

  get #hasNativeAdder() {
    return this.#context.globals.isIntrinsicUnmodifiedAt(this.#context.node, this.#name,
      [ "prototype", ADDER_BY_GLOBAL.get(this.#name) ])
  }

  get #isExactSource() {
    const [ source ] = this.#context.node.arguments
    return ExactIterationSource.isSafeIn(source, this.#context)
  }

  get #isSafeWeakSetSource() {
    const [ source ] = this.#context.node.arguments
    return source.type === "ArrayExpression" && source.elements.every((element) =>
      new DirectObjectValue(element, this.#context.bindings).isPresent) && this.#isExactSource
  }
}

class DirectMapEntries {
  #context
  #source
  #withObjectKeys

  constructor(source, { context, withObjectKeys }) {
    this.#source = source
    this.#context = context
    this.#withObjectKeys = withObjectKeys
  }

  get isSafe() {
    return this.#source.type === "ArrayExpression" && ExactIterationSource.isSafeIn(this.#source, this.#context)
      && this.#source.elements.every((entry) => new DirectMapEntry(entry, {
        context: this.#context,
        withObjectKey: this.#withObjectKeys
      }).isSafe)
  }
}

class DirectMapEntry {
  #context
  #entry
  #withObjectKey

  constructor(entry, { context, withObjectKey }) {
    this.#entry = entry
    this.#context = context
    this.#withObjectKey = withObjectKey
  }

  get isSafe() {
    return this.#entry?.type === "ArrayExpression" && Boolean(this.#entry.elements[0])
      && Boolean(this.#entry.elements[1])
      && (!this.#withObjectKey
        || new DirectObjectValue(this.#entry.elements[0], this.#context.bindings).isPresent)
  }
}

class DirectObjectValue {
  #bindings
  #node

  constructor(node, bindings) {
    this.#bindings = bindings
    this.#node = node
  }

  get isPresent() {
    const value = this.#value
    return DIRECT_OBJECT_TYPES.has(value?.type) || (value?.type === "Literal" && Boolean(value.regex))
  }

  get #value() {
    return stableExpressionFor(this.#node, this.#bindings)
  }
}
