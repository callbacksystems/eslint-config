import { ArrayEvidence } from "#helpers/arrays/array_evidence"
import { calleeMemberName } from "#helpers/syntax/classes"
import { ReceiverEvaluation } from "#helpers/flow/receiver_evaluation"

const ARRAY_MAPPING_METHODS = new Set([ "map", "flatMap" ])
const REDUCING_METHODS = new Set([ "reduce", "reduceRight" ])
const MAPPING_METHODS = ARRAY_MAPPING_METHODS.union(REDUCING_METHODS)
const CONSUMING_METHODS = new Set([
  "every", "filter", "find", "findIndex", "findLast", "findLastIndex", "forEach", "some", "sort", "toSorted"
])
const ARRAY_EVIDENCE_BY_SOURCE = new WeakMap()

export class ArrayCallback {
  #node
  #arrays

  constructor(node, sourceCode) {
    this.#node = node
    this.#arrays = arrayEvidenceFor(sourceCode)
  }

  get isConsuming() {
    return this.#hasMethodIn(CONSUMING_METHODS)
  }

  get isMapping() {
    return this.#hasMethodIn(MAPPING_METHODS)
  }

  get isArrayMapping() {
    return this.#hasMethodIn(ARRAY_MAPPING_METHODS)
  }

  get invocation() {
    return this.#node.parent
  }

  #hasMethodIn(methods) {
    return this.#isSafeInvocation && methods.has(calleeMemberName(this.invocation.callee))
  }

  get #isSafeInvocation() {
    const { invocation } = this
    return invocation.type === "CallExpression" && invocation.arguments[0] === this.#node
      && !invocation.optional && invocation.callee.type === "MemberExpression" && !invocation.callee.optional
      && new ReceiverEvaluation(invocation.callee.object, this.#arrays.bindings).isSafe
      && this.#arrays.isEvident(invocation.callee.object)
  }
}

function arrayEvidenceFor(sourceCode) {
  if (!ARRAY_EVIDENCE_BY_SOURCE.has(sourceCode)) {
    ARRAY_EVIDENCE_BY_SOURCE.set(sourceCode, new ArrayEvidence(sourceCode))
  }
  return ARRAY_EVIDENCE_BY_SOURCE.get(sourceCode)
}
