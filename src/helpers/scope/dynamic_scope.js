import { FunctionExecutionContexts } from "#helpers/flow/function_execution_contexts"
import { ExecutionDominance } from "#helpers/flow/execution_dominance"
import { enclosingFunction } from "#helpers/syntax/functions"
import { NearestAncestor } from "#helpers/syntax/nearest_ancestor"
import { isWithin } from "#helpers/syntax/ranges"
import { BindingDefinition } from "#helpers/scope/binding_definition"
import { isMutableBinding } from "#helpers/scope/binding_mutability"
import { BindingTimeline } from "#helpers/scope/binding_timeline"
import { DynamicBindingCoverage } from "#helpers/scope/dynamic_binding_coverage"
import { DynamicEvalTimeline } from "#helpers/scope/dynamic_eval_timeline"
import { isReassignment } from "#helpers/scope/references"

const ANALYSES_BY_SOURCE = new WeakMap()

export function hasDynamicScope(sourceCode) {
  return analysisOf(sourceCode).isPresent
}

export function hasDynamicScopeIn(sourceCode, node) {
  return analysisOf(sourceCode).isPresentIn(node)
}

export function hasDirectEvalIn(sourceCode, node) {
  return analysisOf(sourceCode).hasDirectEvalIn(node)
}

export function hasUnsafeDynamicLookup(sourceCode, identifier, variable) {
  return analysisOf(sourceCode).hasUnsafeLookup(identifier, variable)
}

function analysisOf(sourceCode) {
  if (!ANALYSES_BY_SOURCE.has(sourceCode)) {
    ANALYSES_BY_SOURCE.set(sourceCode, new DynamicScopeAnalysis(sourceCode))
  }
  return ANALYSES_BY_SOURCE.get(sourceCode)
}

class DynamicScopeAnalysis {
  #sourceCode
  #globals
  #cachedFindings

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
    this.#globals = new GlobalReferences(sourceCode.scopeManager)
  }

  get isPresent() {
    return this.#findings.dynamic.isPresent
  }

  isPresentIn(node) {
    return this.#findings.dynamic.includes(node)
  }

  hasDirectEvalIn(node) {
    return this.#findings.directEval.includesExecutionOf(node)
  }

  hasUnsafeLookup(identifier, variable) {
    const lookup = new DynamicLookup(identifier, variable, this.#globals.scopeOf(identifier))
    return this.#findings.directEval.intercepts(lookup)
  }

  get #findings() {
    return this.#cachedFindings ??= new DynamicFindings(this.#sourceCode, this.#globals)
  }
}

class GlobalReferences {
  #dominance
  #references
  #scopeManager
  #timeline

  constructor(scopeManager) {
    this.#scopeManager = scopeManager
    this.#dominance = new ExecutionDominance(scopeManager.globalScope.block)
    this.#references = new WeakMap(scopeManager.scopes
      .flatMap((scope) => scope.references)
      .map((reference) => [ reference.identifier, reference ]))
  }

  canBeOriginalEval(identifier) {
    const reference = this.#references.get(identifier)
    return Boolean(reference) && !reference.tainted
      && (this.#isUnmodifiedGlobal(reference) || this.#canStillBeOriginal(reference))
  }

  isStrict(identifier) {
    return this.#references.get(identifier)?.from.isStrict ?? false
  }

  scopeOf(identifier) {
    return this.#references.get(identifier)?.from ?? null
  }

  #isUnmodifiedGlobal(reference) {
    return this.#bindingTimeline.isOriginalGlobalAt(reference.identifier, reference.resolved)
  }

  get #bindingTimeline() {
    return this.#timeline ??= new BindingTimeline(this.#scopeManager)
  }

  #canStillBeOriginal(reference) {
    const writes = this.#reachableWritesOf(reference.resolved)
    return this.#bindingTimeline.isGlobalBinding(reference.resolved)
      && writes.length > 0
      && !this.#isDefinitelyReplacedBy(writes, reference.identifier)
  }

  #reachableWritesOf(variable) {
    return variable?.references.filter((reference) =>
      isReassignment(reference) && this.#dominance.isReachable(reference.identifier)) ?? []
  }

  #isDefinitelyReplacedBy(writes, identifier) {
    const { positions } = this.#dominance
    writes.filter(replacesOriginalEval).forEach((write) => positions.add(writeOperationOf(write)))
    return positions.hasBefore(identifier)
  }
}

function replacesOriginalEval(reference) {
  const operation = writeOperationOf(reference)
  return operation?.type !== "AssignmentExpression"
    || (!isIdentityPreservingEvalAssignment(operation, reference)
      && ![ "||=", "??=" ].includes(operation.operator))
}

function writeOperationOf(reference) {
  return reference.writeExpr?.parent ?? reference.identifier.parent
}

function isIdentityPreservingEvalAssignment(operation, reference) {
  return operation.operator === "=" && operation.left === reference.identifier
    && operation.right.type === "Identifier" && operation.right.name === reference.identifier.name
}

class DynamicLookup {
  #variable

  constructor(identifier, variable, scope) {
    this.identifier = identifier
    this.#variable = variable
    this.scope = scope
  }

  get name() {
    return this.identifier.name
  }

  get isUnresolved() {
    return !this.#variable
  }

  hasBindingIn(bindings) {
    return Boolean(this.#variable) && bindings.has(this.#variable)
  }

  hasLifetimeIn(executionScope) {
    return executionScope.block.type === "Program"
      || this.#variable?.scope.variableScope === executionScope
  }

  isProtectedAt(boundary, nonStrictBoundaries) {
    const definition = constantDefinitionOf(this.#variable)
    return nonStrictBoundaries.has(boundary)
      ? Boolean(definition) && isWithin(definition.node, boundary.range)
      : Boolean(this.#variable) && !isMutableBinding(this.#variable)
  }
}

function constantDefinitionOf(variable) {
  const [ definition ] = variable?.defs ?? []
  return hasSingleDefinition(variable) && new BindingDefinition(definition).isConstant ? definition : null
}

function hasSingleDefinition(variable) {
  return variable?.defs.length === 1
}

class DynamicFindings {
  dynamic = null
  directEval = null

  #globals

  constructor(sourceCode, globals) {
    this.dynamic = new DynamicBoundaries(sourceCode)
    this.directEval = new DynamicBoundaries(sourceCode)
    this.#globals = globals
    new FunctionExecutionContexts(sourceCode.ast).forEach(({ node }) => this.#record(node))
  }

  #record(node) {
    if (node.type === "WithStatement") this.dynamic.add(node)
    if (this.#isDirectEval(node)) this.#recordDirectEval(node)
  }

  #isDirectEval(node) {
    const { callee } = node.type === "CallExpression" && !node.optional ? node : {}
    return callee?.type === "Identifier" && callee.name === "eval"
      && this.#globals.canBeOriginalEval(callee)
  }

  #recordDirectEval(node) {
    const options = { isStrict: this.#globals.isStrict(node.callee) }
    this.dynamic.addFunctionHolding(node, options)
    this.directEval.addExecutionHolding(node, options)
    this.directEval.addBindingsAccessibleFrom(this.#globals.scopeOf(node.callee), node)
  }
}

class DynamicBoundaries {
  isPresent = false

  #sourceCode
  #values = new WeakSet()
  #nonStrictValues = new WeakSet()
  #evalScopes = new Set()
  #cachedBindingCoverage
  #evalTimeline = new DynamicEvalTimeline()
  #boundaries = new NearestAncestor((node) => this.#values.has(node))
  #executionBoundaries = new NearestAncestor(isArgumentsEnvironment)

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  addFunctionHolding(node, options) {
    this.add(enclosingFunction(node) ?? this.#sourceCode.ast, options)
  }

  add(node, { isStrict = false } = {}) {
    this.isPresent = true
    this.#values.add(node)
    if (!isStrict) this.#nonStrictValues.add(node)
  }

  addExecutionHolding(node, options) {
    this.add(this.#executionBoundaries.of(node), options)
  }

  addBindingsAccessibleFrom(scope, node) {
    if (scope && !this.#evalScopes.has(scope)) {
      this.#evalScopes.add(scope)
      this.#cachedBindingCoverage = null
    }
    if (scope) this.#evalTimeline.add(node, scope)
  }

  includes(node) {
    return Boolean(this.boundaryOf(node))
  }

  boundaryOf(node) {
    return this.#boundaries.of(node)
  }

  includesExecutionOf(node) {
    return this.#values.has(this.#executionBoundaries.of(node))
  }

  intercepts(lookup) {
    const isIntercepted = this.#interceptsWithinBoundary(lookup) || this.#bindingCoverage.intercepts(lookup)
    return isIntercepted && !this.#evalTimeline.isLookupBeforeAllEvals(lookup)
  }

  #interceptsWithinBoundary(lookup) {
    const boundary = this.#executionBoundaries.of(lookup.identifier)
    return this.#values.has(boundary) && !lookup.isProtectedAt(boundary, this.#nonStrictValues)
  }

  get #bindingCoverage() {
    return this.#cachedBindingCoverage ??=
      new DynamicBindingCoverage(this.#sourceCode.scopeManager, this.#evalScopes)
  }
}

function isArgumentsEnvironment(node) {
  return [ "Program", "FunctionDeclaration", "FunctionExpression" ].includes(node.type)
}
