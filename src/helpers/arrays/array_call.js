import { calleeMemberName } from "#helpers/syntax/classes"
import { hasOwnArgumentsAccess } from "#helpers/syntax/functions"

const TRANSFORMERS = new Set([ "flatMap", "map", "reduce", "reduceRight" ])
const CONTAINER_RESULTS = new Set([
  "concat", "copyWithin", "filter", "flat", "reverse", "slice", "sort", "splice", "toReversed", "toSorted",
  "toSpliced", "with"
])
const ITEM_RESULTS = new Set([ "at", "find", "findLast", "pop", "shift" ])
const CONSUMERS = new Set([ "every", "findIndex", "findLastIndex", "forEach", "some" ])
const STANDARD_CALLBACKS = new Set([
  "every", "filter", "find", "findIndex", "findLast", "findLastIndex", "flatMap", "forEach", "map", "some"
])
const COMPARATORS = new Set([ "sort", "toSorted" ])
const REDUCERS = new Set([ "reduce", "reduceRight" ])

export class ArrayCall {
  #call
  #flow

  constructor(call, flow) {
    this.#call = call
    this.#flow = flow
  }

  get staysHere() {
    return this.#isKnown && this.#isCallbackKept && this.#isResultKept
  }

  get #isKnown() {
    return this.#callbackPositions !== null || CONTAINER_RESULTS.has(this.#name)
      || ITEM_RESULTS.has(this.#name) || CONSUMERS.has(this.#name)
  }

  get #callbackPositions() {
    if (STANDARD_CALLBACKS.has(this.#name)) return [ [ 0, null ], [ 2, "array" ] ]
    if (COMPARATORS.has(this.#name)) return [ [ 0, null ], [ 1, null ] ]
    if (REDUCERS.has(this.#name)) return [ [ 0, null ], [ 1, null ], [ 3, "array" ] ]

    return null
  }

  get #name() {
    return calleeMemberName(this.#call.callee) ?? ""
  }

  get #isCallbackKept() {
    const positions = this.#callbackPositions
    if (positions) {
      const callback = callbackIn(this.#call, this.#flow)
      if (!callback && this.#hasOmittedComparator) return true

      return Boolean(callback) && !hasOwnArgumentsAccess(callback, this.#flow.sourceCode)
        && positions.every(([ position, containerKind ]) =>
          this.#flow.keepsParameter(callback, { position, containerKind }))
    } else {
      return true
    }
  }

  get #hasOmittedComparator() {
    return COMPARATORS.has(this.#name) && this.#call.arguments.length === 0
  }

  get #isResultKept() {
    if (CONTAINER_RESULTS.has(this.#name)) return this.#flow.keepsResult(this.#call, "array")
    if (ITEM_RESULTS.has(this.#name)) return this.#flow.keepsResult(this.#call, null)
    if (this.#isUnseededReduction) return this.#flow.keepsResult(this.#call, null)

    return TRANSFORMERS.has(this.#name) || CONSUMERS.has(this.#name)
  }

  get #isUnseededReduction() {
    return REDUCERS.has(this.#name) && (this.#call.arguments.length < 2
      || this.#call.arguments[1].type === "SpreadElement")
  }
}

function callbackIn(call, flow) {
  const callback = call.arguments[0]
  if (callback?.type === "Identifier") return flow.functionFor(callback)

  return callback?.type === "FunctionExpression" || callback?.type === "ArrowFunctionExpression" ? callback : null
}
