import { ExecutionDominance } from "#helpers/flow/execution_dominance"
import { HeaderParameterReferenceUse } from "#helpers/http/header_parameter_reference"
import { nodesIn } from "#helpers/syntax/ast"
import { enclosingFunction, isFunction } from "#helpers/syntax/functions"
import { StandardGlobals } from "#helpers/scope/standard_globals"
import { ObjectSpreadEvaluation } from "#helpers/objects/object_spread_evaluation"
import { ReceiverMutationIndex } from "#helpers/scope/receiver_mutation_index"

export class HeaderArgumentConfinement {
  #bindings
  #callees
  #graph

  constructor(sourceCode, bindings, { functionFor, isOriginalParameterAt, valuesOf }) {
    this.#bindings = bindings
    this.#callees = { functionFor }
    this.#graph = new ParameterConfinementGraph(sourceCode, {
      callees: this.#callees, bindings, isOriginalParameterAt, valuesOf
    })
  }

  includes(identifier) {
    const parameter = HeaderParameterReferenceUse.receivingParameterAt(
      identifier, { bindings: this.#bindings, callees: this.#callees })
    return Boolean(parameter) && this.#graph.isConfined(parameter)
  }

  canResolve(identifier) {
    return this.#graph.isConfined(this.#bindings.variableFor(identifier))
  }

  includesValue(identifier) {
    return this.#graph.includes(this.#bindings.variableFor(identifier))
  }

  hasUnmodifiedMemberAt(identifier, name, target) {
    return this.#graph.hasUnmodifiedMemberAt(identifier, name, target)
  }

  resolutionSourceFor(identifier) {
    return this.#graph.resolutionSourceFor(identifier)
  }
}

class ParameterConfinementGraph {
  #aliasesBySource = new Map()
  #bindings
  #callees
  #dependents = new Map()
  #execution
  #globals
  #isOriginalParameterAt
  #aliasInitializers = new WeakSet()
  #owners = new Map()
  #parameters = new Set()
  #receiverMutations = new WeakMap()
  #resolutionSources = new Map()
  #rootByVariable = new Map()
  #unsafe = new Set()
  #variablesByParameter = new Map()
  #valuesOf

  constructor(sourceCode, { bindings, callees, isOriginalParameterAt, valuesOf }) {
    this.#bindings = bindings
    this.#callees = callees
    this.#execution = new ExecutionDominance(sourceCode.ast)
    this.#globals = new StandardGlobals(bindings)
    this.#isOriginalParameterAt = isOriginalParameterAt
    this.#valuesOf = valuesOf
    this.#indexParameters(sourceCode.ast)
    this.#indexAliases(sourceCode.ast)
    this.#indexUses()
    this.#propagateUnsafeParameters()
  }

  isConfined(parameter) {
    const root = this.#rootByVariable.get(parameter)
    return Boolean(root) && !this.#unsafe.has(root)
  }

  includes(variable) {
    return this.#rootByVariable.has(variable)
  }

  hasUnmodifiedMemberAt(identifier, name, target) {
    const variable = this.#bindings.variableFor(identifier)
    const parameter = this.#rootByVariable.get(variable)
    const reference = variable?.references.find((candidate) => candidate.identifier === identifier)
    return Boolean(parameter) && !this.#unsafe.has(parameter) && Boolean(reference)
      && !this.#receiverMutationsFor(parameter).hasPropertyMutationBefore({ name, reference, target })
  }

  resolutionSourceFor(identifier) {
    const variable = this.#bindings.variableFor(identifier)
    const root = this.#rootByVariable.get(variable)
    if (!root || this.#unsafe.has(root)) return null
    return variable === root ? identifier : this.#resolutionSources.get(variable) ?? null
  }

  #indexParameters(root) {
    for (const node of nodesIn(root)) {
      if (isFunction(node)) this.#indexFunction(node)
    }
  }

  #indexFunction(functionNode) {
    functionNode.params.filter(isIdentifier).forEach((identifier) => {
      const parameter = this.#bindings.variableFor(identifier)
      if (parameter) {
        this.#parameters.add(parameter)
        this.#rootByVariable.set(parameter, parameter)
        this.#variablesByParameter.set(parameter, new Set([ parameter ]))
        this.#owners.set(parameter, functionNode)
        if (functionNode.async || functionNode.generator) this.#unsafe.add(parameter)
      }
    })
  }

  #indexAliases(root) {
    for (const node of nodesIn(root)) {
      if (isStableAlias(node, this.#bindings)) this.#indexAlias(node)
    }

    const pending = Array.from(this.#parameters)
    while (pending.length > 0) {
      const source = pending.pop()
      this.#aliasesBySource.get(source)?.forEach((declarator) => this.#linkAlias(source, declarator, pending))
    }
  }

  #indexAlias(declarator) {
    const source = this.#bindings.variableFor(declarator.init)
    if (!this.#aliasesBySource.has(source)) this.#aliasesBySource.set(source, [])
    this.#aliasesBySource.get(source).push(declarator)
  }

  #linkAlias(source, declarator, pending) {
    const parameter = this.#rootByVariable.get(source)
    const isOriginal = source !== parameter || this.#isOriginalParameterAt(declarator.init)
    if (isOriginal && enclosingFunction(declarator.init) === this.#owners.get(parameter)) {
      this.#linkOriginalAlias({ declarator, parameter, pending, source })
    }
  }

  #linkOriginalAlias({ declarator, parameter, pending, source }) {
    const alias = this.#bindings.variableFor(declarator.id)
    if (!this.#rootByVariable.has(alias)) {
      this.#rootByVariable.set(alias, parameter)
      this.#variablesByParameter.get(parameter).add(alias)
      this.#aliasInitializers.add(declarator.init)
      this.#resolutionSources.set(alias, source === parameter ? declarator.init : this.#resolutionSources.get(source))
      pending.push(alias)
    }
  }

  #indexUses() {
    this.#parameters.forEach((parameter) => {
      this.#variablesByParameter.get(parameter).forEach((variable) => {
        if (variable.identifiers.some((identifier) => this.#bindings.isDynamicallyResolved(identifier))) {
          this.#unsafe.add(parameter)
        }
        variable.references.filter((reference) => this.#execution.isReachable(reference.identifier))
          .forEach((reference) => this.#indexReference(parameter, reference))
      })
    })
  }

  #indexReference(parameter, reference) {
    const use = new HeaderParameterReferenceUse(parameter, reference, {
      aliasInitializers: this.#aliasInitializers,
      bindings: this.#bindings,
      callees: this.#callees,
      globals: this.#globals,
      isSafeSpread: this.#isSafeSpread(reference.identifier),
      owner: this.#owners.get(parameter),
      rootByVariable: this.#rootByVariable
    })
    if (use.isOutsideOwner || !use.isSafe) this.#unsafe.add(parameter)
    else if (use.dependency) this.#dependentsOf(use.dependency).add(parameter)
  }

  #isSafeSpread(identifier) {
    if (isSpreadRead(identifier)) {
      const source = this.resolutionSourceFor(identifier) ?? identifier
      const values = this.#valuesOf(source)
      return values.length > 0 && values.every((value) => new ObjectSpreadEvaluation(value).isSideEffectFree)
    } else {
      return false
    }
  }

  #dependentsOf(parameter) {
    if (!this.#dependents.has(parameter)) this.#dependents.set(parameter, new Set())
    return this.#dependents.get(parameter)
  }

  #propagateUnsafeParameters() {
    const pending = Array.from(this.#unsafe)
    while (pending.length > 0) {
      this.#dependents.get(pending.pop())?.forEach((parameter) => {
        if (!this.#unsafe.has(parameter)) {
          this.#unsafe.add(parameter)
          pending.push(parameter)
        }
      })
    }
  }

  #receiverMutationsFor(parameter) {
    if (!this.#receiverMutations.has(parameter)) {
      this.#receiverMutations.set(parameter, new ReceiverMutationIndex(this.#variablesByParameter.get(parameter), {
        bindings: this.#bindings,
        root: this.#bindings.sourceCode.ast,
        rootScope: parameter.scope.variableScope
      }))
    }
    return this.#receiverMutations.get(parameter)
  }
}

function isIdentifier(node) {
  return node.type === "Identifier"
}

function isStableAlias(node, bindings) {
  return node.type === "VariableDeclarator" && node.id.type === "Identifier" && node.init?.type === "Identifier"
    && bindings.isUnmodified(node.id)
}

function isSpreadRead(identifier) {
  return identifier.parent?.type === "SpreadElement" && identifier.parent.argument === identifier
}
