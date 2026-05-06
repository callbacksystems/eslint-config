import { referencesIn } from "#helpers/scope/references"
import { ExecutionDominance } from "#helpers/flow/execution_dominance"
import { ExecutionPosition } from "#helpers/flow/execution_position"
import { isFunction } from "#helpers/syntax/functions"
import { nodesIn } from "#helpers/syntax/ast"

export class LocalArgumentValues {
  #argumentsByParameter = new WeakMap()
  #bindings
  #callees
  #parameters
  #values = new WeakMap()

  constructor(sourceCode, bindings, { functionFor } = {}) {
    this.#bindings = bindings
    this.#callees = functionFor ? { functionFor } : new LocalCallees(bindings)
    const execution = new ExecutionDominance(sourceCode.ast)
    this.#parameters = new OriginalParameterValues(sourceCode, bindings, execution)
    for (const node of nodesIn(sourceCode)) {
      if (node.type === "CallExpression" && execution.isReachable(node)) this.#record(node)
    }
  }

  valuesOf(node) {
    return node ? this.#valuesOfNode(node) : []
  }

  isOriginalParameterAt(identifier) {
    const variable = this.#bindings.variableFor(identifier)
    return variable?.defs.some(({ type }) => type === "Parameter") === true
      && this.#parameters.isOriginalAt(identifier, variable)
  }

  #record(call) {
    const functionNode = this.#callees.functionFor(call.callee)
    if (isTraceableCall(call, functionNode)) {
      functionNode.params.forEach((parameter, index) => {
        if (parameter.type === "Identifier" && index < call.arguments.length) {
          this.#recordArgumentFor(parameter, call.arguments[index])
        }
      })
    }
  }

  #recordArgumentFor(parameter, argument) {
    const variable = this.#bindings.variableFor(parameter)
    if (!variable || this.#bindings.isDynamicallyResolved(parameter)) return

    if (!this.#argumentsByParameter.has(variable)) this.#argumentsByParameter.set(variable, [])
    this.#argumentsByParameter.get(variable).push(argument)
  }

  #valuesOfNode(node) {
    if (!this.#values.has(node)) {
      this.#values.set(node, Object.freeze(new ArgumentValueSearch(node, {
        argumentsByParameter: this.#argumentsByParameter,
        bindings: this.#bindings,
        parameters: this.#parameters
      }).values))
    }
    return this.#values.get(node)
  }
}

class LocalCallees {
  #bindings

  constructor(bindings) {
    this.#bindings = bindings
  }

  functionFor(callee) {
    if (isFunction(callee)) return callee
    return callee.type === "Identifier" ? this.#bindings.functionFor(callee) : null
  }
}

class OriginalParameterValues {
  #bindings
  #dominance
  #histories = new WeakMap()
  #references
  #values = new WeakMap()

  constructor(sourceCode, bindings, dominance) {
    this.#bindings = bindings
    this.#dominance = dominance
    this.#references = referencesIn(sourceCode.scopeManager)
  }

  isOriginalAt(identifier, variable) {
    if (!this.#values.has(identifier)) {
      this.#values.set(identifier, !this.#bindings.isDynamicallyResolved(identifier)
      && this.#historyOf(variable).isOriginalAt(identifier, this.#references.get(identifier)))
    }
    return this.#values.get(identifier)
  }

  #historyOf(variable) {
    if (!this.#histories.has(variable)) {
      this.#histories.set(variable, new ParameterHistory(variable, this.#dominance))
    }
    return this.#histories.get(variable)
  }
}

class ParameterHistory {
  #executionScope
  #summaries = new WeakMap()
  #writeCount = 0

  constructor(variable, dominance) {
    this.#executionScope = variable.scope.variableScope
    variable.references.filter((reference) => reference.isWrite() && dominance.isReachable(reference.identifier))
      .forEach((reference) => this.#add(reference))
  }

  isOriginalAt(identifier, reference) {
    if (this.#writeCount === 0) return true

    const position = reference ? ExecutionPosition.of(identifier, reference.from) : null
    if (position?.executionScope !== this.#executionScope) return false

    const summary = this.#summaries.get(position.sequence)
    return summary?.count === this.#writeCount && position.position < summary.firstPosition
  }

  #add(reference) {
    this.#writeCount += 1
    const position = ExecutionPosition.of(reference.identifier, reference.from)
    if (position?.executionScope === this.#executionScope) this.#summaryFor(position.sequence).add(position.position)
  }

  #summaryFor(sequence) {
    if (!this.#summaries.has(sequence)) this.#summaries.set(sequence, new ParameterWriteSummary())
    return this.#summaries.get(sequence)
  }
}

class ParameterWriteSummary {
  count = 0
  firstPosition = Infinity

  add(position) {
    this.count += 1
    this.firstPosition = Math.min(this.firstPosition, position)
  }
}

function isTraceableCall(call, functionNode) {
  return Boolean(functionNode) && functionNode.generator !== true
    && !call.arguments.some(isSpreadArgument)
}

function isSpreadArgument(argument) {
  return argument.type === "SpreadElement"
}

class ArgumentValueSearch {
  #argumentsByParameter
  #bindings
  #parameters
  #pending
  #seenNodes = new WeakSet()
  #seenParameters = new WeakSet()
  #values = []

  constructor(node, { argumentsByParameter, bindings, parameters }) {
    this.#argumentsByParameter = argumentsByParameter
    this.#bindings = bindings
    this.#parameters = parameters
    this.#pending = [ node ]
  }

  get values() {
    while (this.#pending.length > 0) this.#visit(this.#pending.pop())
    return this.#values
  }

  #visit(node) {
    if (this.#seenNodes.has(node)) return

    this.#seenNodes.add(node)

    const parameter = node.type === "Identifier" ? this.#parameterFor(node) : null
    if (parameter) this.#follow(parameter)
    else this.#followStableValueOrAdd(node)
  }

  #parameterFor(identifier) {
    const variable = this.#bindings.variableFor(identifier)
    return this.#argumentsByParameter.has(variable) && this.#parameters.isOriginalAt(identifier, variable)
      ? variable
      : null
  }

  #follow(parameter) {
    if (this.#seenParameters.has(parameter)) return

    this.#seenParameters.add(parameter)
    this.#pending.push(...this.#argumentsByParameter.get(parameter))
  }

  #followStableValueOrAdd(node) {
    const value = node.type === "Identifier" ? this.#bindings.stableValueFor(node) : null
    if (value && value !== node) this.#pending.push(value)
    else this.#values.push(node)
  }
}
