import { ExactIterationSource } from "#helpers/flow/exact_iteration_source"
import { NativeEvaluationInput } from "#helpers/flow/native_evaluation_input"

const GLOBAL_NAMES = new Set([ "FormData", "Headers", "URLSearchParams" ])

export class WebCollectionReceiverEvaluation {
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
    if (!source || new NativeEvaluationInput(source, this.#context.bindings).isUndefined) return true
    if (this.#name === "FormData") return false
    if (this.#name === "URLSearchParams"
      && new NativeEvaluationInput(source, this.#context.bindings).isSafe) return true
    return new DirectStringPairs(source, this.#context).isSafe
  }

  get #name() {
    return this.#globalName ??= GLOBAL_NAMES.values().find((name) =>
      this.#context.isNew && this.#context.globals.matches(this.#context.node.callee, name)) ?? null
  }
}

class DirectStringPairs {
  #context
  #source

  constructor(source, context) {
    this.#source = source
    this.#context = context
  }

  get isSafe() {
    return this.#isSafeRecord || this.#isSafeSequence
  }

  get #isSafeRecord() {
    return this.#source.type === "ObjectExpression" && this.#hasNoIterator
      && this.#source.properties.every((property) => new DirectStringProperty(property, this.#context.bindings).isSafe)
  }

  get #hasNoIterator() {
    return this.#context.globals.isAbsentAndUnmodifiedAt(this.#context.node, "Object", [ "prototype", Symbol.iterator ])
  }

  get #isSafeSequence() {
    return this.#source.type === "ArrayExpression" && ExactIterationSource.isSafeIn(this.#source, this.#context)
      && this.#source.elements.every((element) => new DirectStringEntry(element, this.#context).isSafe)
  }
}

class DirectStringProperty {
  #bindings
  #property

  constructor(property, bindings) {
    this.#property = property
    this.#bindings = bindings
  }

  get isSafe() {
    return this.#property.type === "Property" && !this.#property.computed && this.#property.kind === "init"
      && new NativeEvaluationInput(this.#property.value, this.#bindings).isSafe
  }
}

class DirectStringEntry {
  #context
  #entry

  constructor(entry, context) {
    this.#entry = entry
    this.#context = context
  }

  get isSafe() {
    return this.#entry?.type === "ArrayExpression" && this.#entry.elements.length === 2
      && ExactIterationSource.isSafeIn(this.#entry, this.#context)
      && this.#entry.elements.every((element) =>
        new NativeEvaluationInput(element, this.#context.bindings).isSafe)
  }
}
