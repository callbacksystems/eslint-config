import { booleanOperandsOf, nodesIn, pushAll } from "#helpers/syntax/ast"
import { BooleanExpression } from "#helpers/flow/boolean_expression"
import { canFallThrough, hasReachableReturn } from "#helpers/flow/function_completion"
import { hasBareReturn, isFunction, ownReturnArguments } from "#helpers/syntax/functions"
import { CalleeResolver } from "#helpers/scope/callee_resolver"
import { ArrayEvidence } from "#helpers/arrays/array_evidence"
import { stableExpressionFor } from "#helpers/flow/stable_expression"

const ANALYSES_BY_SOURCE = new WeakMap()

export class BooleanReturnAnalysis {
  #sourceCode

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  returnsBooleanFrom(functionNode) {
    return this.#functions.includes(functionNode)
  }

  get #functions() {
    if (!ANALYSES_BY_SOURCE.has(this.#sourceCode)) {
      ANALYSES_BY_SOURCE.set(this.#sourceCode, new BooleanFunctions(this.#sourceCode))
    }
    return ANALYSES_BY_SOURCE.get(this.#sourceCode)
  }
}

class BooleanFunctions {
  #analyses
  #dependents
  #cachedStructural
  #cachedEvidenced

  constructor(sourceCode) {
    const resolver = new CalleeResolver(sourceCode)
    const arrays = new ArrayEvidence(sourceCode)
    const { bindings } = arrays
    this.#analyses = new Map(nodesIn(sourceCode.ast).filter(isFunction)
      .map((functionNode) => [ functionNode, new BooleanFunction(functionNode, { arrays, bindings, resolver }) ]))
    this.#dependents = new FunctionDependents(this.#analyses)
  }

  includes(functionNode) {
    return this.#structural.has(functionNode) && this.#evidenced.has(functionNode)
  }

  get #structural() {
    return this.#cachedStructural ??= new StructuralFunctions(this.#analyses, this.#dependents).values
  }

  get #evidenced() {
    return this.#cachedEvidenced ??=
      new EvidencedFunctions(this.#analyses, this.#dependents, this.#structural).values
  }
}

class BooleanFunction {
  #functionNode
  #resolver
  #bindings
  #arrays
  #cachedReturned
  #cachedDependencies
  #cachedCanReturnBoolean

  constructor(functionNode, { arrays, bindings, resolver }) {
    this.#functionNode = functionNode
    this.#resolver = resolver
    this.#bindings = bindings
    this.#arrays = arrays
  }

  get dependencies() {
    return this.#cachedDependencies ??=
      new BooleanDependencies(this.#returned, this.#resolver, this.#bindings).values
  }

  isBooleanIn(functions) {
    return this.canReturnBoolean
      && this.#returned.every((node) => this.#expressionFor(node, functions).isBoolean)
  }

  get canReturnBoolean() {
    return this.#cachedCanReturnBoolean ??= !this.#functionNode.generator
      && hasReachableReturn(this.#functionNode)
      && !hasBareReturn(this.#functionNode)
      && !canFallThrough(this.#functionNode)
  }

  hasEvidenceIn(functions) {
    return this.#returned.some((node) => this.#expressionFor(node, functions).hasEvidence)
  }

  get #returned() {
    return this.#cachedReturned ??= ownReturnArguments(this.#functionNode)
  }

  #expressionFor(node, functions) {
    return new BooleanExpression(node, {
      arrays: this.#arrays,
      resolver: this.#resolver,
      bindings: this.#bindings,
      functions
    })
  }
}

class BooleanDependencies {
  #bindings
  #pending
  #resolver
  #values = new Set()

  constructor(returned, resolver, bindings) {
    this.#pending = returned.toReversed()
    this.#resolver = resolver
    this.#bindings = bindings
  }

  get values() {
    while (this.#pending.length > 0) this.#add(this.#pending.pop())
    return this.#values
  }

  #add(node) {
    const expression = stableExpressionFor(node, this.#bindings)
    if (expression === node) this.#addExpression(expression)
    else this.#pending.push(expression)
  }

  #addExpression(node) {
    const operands = booleanOperandsOf(node)
    if (operands) pushAll(this.#pending, operands)
    else if (node.type === "CallExpression") this.#addCall(node)
  }

  #addCall(call) {
    const target = this.#resolver.functionFor(call.callee)
    if (target) this.#values.add(target)
  }
}

class FunctionDependents {
  #byDependency = new Map()

  constructor(analyses) {
    analyses.forEach((analysis, dependent) => {
      analysis.dependencies.values().filter((dependency) => analyses.has(dependency))
        .forEach((dependency) => this.#add(dependent, dependency))
    })
  }

  of(functionNode) {
    return this.#byDependency.get(functionNode) ?? []
  }

  #add(dependent, dependency) {
    const dependents = this.#byDependency.get(dependency) ?? new Set()
    dependents.add(dependent)
    this.#byDependency.set(dependency, dependents)
  }
}

class StructuralFunctions {
  #analyses
  #dependents
  #accepted
  #pending

  constructor(analyses, dependents) {
    this.#analyses = analyses
    this.#dependents = dependents
    this.#accepted = new Set(analyses.entries().filter(([ , analysis ]) => analysis.canReturnBoolean)
      .map(([ functionNode ]) => functionNode))
    this.#pending = new PendingFunctions(this.#accepted)
  }

  get values() {
    while (this.#pending.hasNext) this.#reconsider(this.#pending.next)
    return this.#accepted
  }

  #reconsider(functionNode) {
    if (this.#shouldRemove(functionNode)) {
      this.#accepted.delete(functionNode)
      this.#pending.addAll(this.#dependents.of(functionNode))
    }
  }

  #shouldRemove(functionNode) {
    return this.#accepted.has(functionNode) && !this.#analyses.get(functionNode).isBooleanIn(this.#accepted)
  }
}

class PendingFunctions {
  #values = []
  #scheduled = new Set()
  #position = 0

  constructor(functions) {
    this.addAll(functions)
  }

  addAll(functions) {
    functions.forEach((functionNode) => {
      if (!this.#scheduled.has(functionNode)) {
        this.#scheduled.add(functionNode)
        this.#values.push(functionNode)
      }
    })
  }

  get hasNext() {
    return this.#position < this.#values.length
  }

  get next() {
    return this.#take(this.#values[this.#position])
  }

  #take(functionNode) {
    this.#position += 1
    this.#scheduled.delete(functionNode)
    return functionNode
  }
}

class EvidencedFunctions {
  #analyses
  #dependents
  #structural
  #values = new Set()
  #pending

  constructor(analyses, dependents, structural) {
    this.#analyses = analyses
    this.#dependents = dependents
    this.#structural = structural
    this.#pending = new PendingFunctions(structural)
  }

  get values() {
    while (this.#pending.hasNext) this.#consider(this.#pending.next)
    return this.#values
  }

  #consider(functionNode) {
    if (this.#shouldAccept(functionNode)) {
      this.#values.add(functionNode)
      this.#pending.addAll(this.#dependents.of(functionNode))
    }
  }

  #shouldAccept(functionNode) {
    return this.#structural.has(functionNode) && !this.#values.has(functionNode)
      && this.#analyses.get(functionNode).hasEvidenceIn(this.#values)
  }
}
