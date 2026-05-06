import { resolvedPublicMemberNameOf } from "#helpers/classes/resolved_member_key"

const ANALYSES_BY_SOURCE = new WeakMap()
const CALLBACK_PRODUCERS = new Set([ "filter", "map" ])
const PRODUCERS = CALLBACK_PRODUCERS.union(new Set([ "toReversed" ]))

export class ArrayReceiverEvaluation {
  #analysis
  #context

  constructor(context) {
    this.#context = context
    this.#analysis = analysisFor(context)
  }

  get matches() {
    return new ArrayProducer(this.#context.node, this.#context).matches
  }

  get isSafe() {
    return this.#analysis.isSafe(this.#context.node)
  }
}

function analysisFor(context) {
  const { sourceCode } = context.bindings
  if (!ANALYSES_BY_SOURCE.has(sourceCode)) {
    ANALYSES_BY_SOURCE.set(sourceCode, new ArrayReceiverAnalysis(context))
  }
  return ANALYSES_BY_SOURCE.get(sourceCode)
}

class ArrayReceiverAnalysis {
  #context
  #facts = new WeakMap()

  constructor(context) {
    this.#context = context
  }

  isSafe(node) {
    if (!this.#facts.has(node)) new ArrayReceiverWalk(node, this, this.#context).complete()
    return this.#facts.get(node)
  }

  has(node) {
    return this.#facts.has(node)
  }

  valueOf(node) {
    return this.#facts.get(node)
  }

  remember(nodes, value) {
    nodes.forEach((node) => this.#facts.set(node, value))
  }
}

class ArrayReceiverWalk {
  #analysis
  #context
  #current
  #path = []

  constructor(node, analysis, context) {
    this.#current = node
    this.#analysis = analysis
    this.#context = context
  }

  complete() {
    while (!this.#analysis.has(this.#current)) {
      const producer = new ArrayProducer(this.#current, this.#context)
      if (!producer.matches) return this.#remember(new DirectDenseArray(this.#current).isPresent)
      if (!producer.isLocallySafe) return this.#remember(false)

      this.#path.push(this.#current)
      this.#current = producer.receiver
    }
    return this.#remember(this.#analysis.valueOf(this.#current))
  }

  #remember(value) {
    this.#analysis.remember(this.#path, value)
    if (!this.#analysis.has(this.#current)) this.#analysis.remember([ this.#current ], value)
  }
}

class ArrayProducer {
  #bindings
  #globals
  #node

  constructor(node, { bindings, globals }) {
    this.#node = node
    this.#bindings = bindings
    this.#globals = globals
  }

  get matches() {
    return this.#node.type === "CallExpression" && this.#node.callee.type === "MemberExpression"
      && PRODUCERS.has(this.#method)
  }

  get isLocallySafe() {
    return this.#hasNativeMethod && this.#hasNativeResult && this.#hasSafeCallback
  }

  get receiver() {
    return this.#node.callee.object
  }

  get #method() {
    return resolvedPublicMemberNameOf(this.#node.callee, this.#bindings)
  }

  get #hasNativeMethod() {
    return this.#globals.isIntrinsicUnmodifiedAt(this.#node.callee, "Array", [ "prototype", this.#method ])
  }

  get #hasNativeResult() {
    return !CALLBACK_PRODUCERS.has(this.#method) || this.#hasDefaultSpecies
  }

  get #hasDefaultSpecies() {
    return this.#globals.isIntrinsicUnmodifiedAt(this.#node, "Array", [ "prototype", "constructor" ])
      && this.#globals.isIntrinsicUnmodifiedAt(this.#node, "Array", [ Symbol.species ])
      && this.#globals.isIntrinsicUnmodifiedAt(this.#node, "Array", [ "prototype", "constructor", Symbol.species ])
  }

  get #hasSafeCallback() {
    return !CALLBACK_PRODUCERS.has(this.#method) || new DirectCallback(this.#node.arguments[0]).isSafe
  }
}

class DirectCallback {
  #node

  constructor(node) {
    this.#node = node
  }

  get isSafe() {
    return [ "ArrowFunctionExpression", "FunctionExpression" ].includes(this.#node?.type)
      && !this.#node.async && this.#hasSimpleParameters
      && (this.#node.generator || new DirectCallbackValue(this.#node.body).isSafe)
  }

  get #hasSimpleParameters() {
    return this.#node.params.every((parameter) => parameter.type === "Identifier")
  }
}

class DirectCallbackValue {
  #node

  constructor(node) {
    this.#node = node
  }

  get isSafe() {
    if ([ "Identifier", "Literal", "ThisExpression" ].includes(this.#node.type)) return true
    return this.#node.type === "UnaryExpression" && [ "!", "typeof", "void" ].includes(this.#node.operator)
      && [ "Identifier", "Literal", "ThisExpression" ].includes(this.#node.argument.type)
  }
}

class DirectDenseArray {
  #node

  constructor(node) {
    this.#node = node
  }

  get isPresent() {
    return this.#node.type === "ArrayExpression" && this.#node.elements.every((element) =>
      Boolean(element) && element.type !== "SpreadElement")
  }
}
