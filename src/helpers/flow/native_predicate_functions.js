import { ArrayEvidence } from "#helpers/arrays/array_evidence"
import { CalleeResolver } from "#helpers/scope/callee_resolver"
import { NativeBooleanCall } from "#helpers/flow/native_boolean_call"
import { isFunction, soleStatementOf } from "#helpers/syntax/functions"
import { nodesIn } from "#helpers/syntax/ast"

const FUNCTIONS_BY_SOURCE = new WeakMap()

export class NativePredicateFunctions {
  #sourceCode

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  includes(functionNode) {
    return this.#functions.has(functionNode)
  }

  get #functions() {
    if (!FUNCTIONS_BY_SOURCE.has(this.#sourceCode)) {
      FUNCTIONS_BY_SOURCE.set(this.#sourceCode, new NativePredicatePropagation(this.#sourceCode).functions)
    }
    return FUNCTIONS_BY_SOURCE.get(this.#sourceCode)
  }
}

class NativePredicatePropagation {
  #facts
  #parents = new Map()
  #values = new Set()

  constructor(sourceCode) {
    const arrays = new ArrayEvidence(sourceCode)
    const resolver = new CalleeResolver(sourceCode)
    this.#facts = new Map(nodesIn(sourceCode.ast).filter(isFunction)
      .map((functionNode) => [ functionNode, new NativePredicateFact(functionNode, { arrays, resolver }) ]))
  }

  get functions() {
    this.#index()
    this.#propagate()
    return this.#values
  }

  #index() {
    this.#facts.forEach((fact, functionNode) => {
      if (fact.hasNativeContract) this.#values.add(functionNode)
      else if (fact.target) this.#parentsOf(fact.target).add(functionNode)
    })
  }

  #parentsOf(functionNode) {
    if (!this.#parents.has(functionNode)) this.#parents.set(functionNode, new Set())
    return this.#parents.get(functionNode)
  }

  #propagate() {
    const pending = Array.from(this.#values)
    while (pending.length > 0) {
      this.#parents.get(pending.pop())?.forEach((functionNode) => {
        if (!this.#values.has(functionNode)) {
          this.#values.add(functionNode)
          pending.push(functionNode)
        }
      })
    }
  }
}

class NativePredicateFact {
  #arrays
  #functionNode
  #resolver

  constructor(functionNode, { arrays, resolver }) {
    this.#functionNode = functionNode
    this.#arrays = arrays
    this.#resolver = resolver
  }

  get hasNativeContract() {
    return this.#invocation
      ? new NativeBooleanCall(this.#invocation,
        { arrays: this.#arrays, bindings: this.#arrays.bindings }).hasBooleanContract
      : false
  }

  get target() {
    const target = this.#invocation ? this.#resolver.functionFor(this.#invocation.callee) : null
    return isSupportedTarget(target) ? target : null
  }

  get #invocation() {
    const statement = soleStatementOf(this.#functionNode.body)
    return statement?.type === "ReturnStatement" && statement.argument?.type === "CallExpression"
      ? statement.argument
      : null
  }
}

function isSupportedTarget(target) {
  return Boolean(target) && !target.async && !target.generator
}
