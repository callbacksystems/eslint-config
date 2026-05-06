// Anything the file does not show is taken as leaving, so an instance is kept only where the code proves it.

import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ClassThisBindings } from "#helpers/classes/class_this_bindings"
import { hasDynamicScope } from "#helpers/scope/dynamic_scope"
import { exportedVariablesIn } from "#helpers/scope/exports"
import { positionalParameterAt } from "#helpers/syntax/functions"
import { keepsClassUse, staysAt } from "#helpers/flow/module_value_flow"
import { MemberReads } from "#helpers/classes/member_reads"

const MODULE_INDEXES = new WeakMap()

export class ModuleView {
  #resolver
  #index
  #instanceEvaluation
  #hasDynamicScope

  constructor(sourceCode) {
    this.sourceCode = sourceCode
    this.#resolver = new BindingResolver(sourceCode)
    this.#index = moduleIndexFor(sourceCode)
    this.#hasDynamicScope = hasDynamicScope(sourceCode)
    this.#instanceEvaluation = new ClassEvaluation(
      (classNode) => this.#keepsInstancesOf(classNode),
      this.#index.instanceResults
    )
  }

  keepsInstancesOf(classNode) {
    return this.#instanceEvaluation.keeps(classNode)
  }

  isExportedDeclaration(node) {
    if (node.parent?.type === "ExportDefaultDeclaration") return true

    const declaration = node.parent?.type === "VariableDeclarator" ? node.parent : node
    return this.sourceCode.getDeclaredVariables(declaration)
      .some((variable) => this.#index.exportedVariables.has(variable))
  }

  functionFor(identifier) {
    return this.#resolver.functionFor(identifier)
  }

  classFor(identifier) {
    return this.#resolver.classFor(identifier)
  }

  parameterAt(functionNode, position) {
    const parameter = positionalParameterAt(functionNode, position)
    return parameter ? this.#resolver.variableFor(parameter) : null
  }

  referencesTo(node) {
    return this.#resolver.variableFor(new BindingIdentifier(node).value)?.references
      .filter((reference) => reference.isRead()) ?? []
  }

  memberReadsFor(member, { owner, isStatic }) {
    return this.#index.memberReadsFor(member, { owner, isStatic })
  }

  thisExpressionsOf(classNode) {
    return this.#index.thisExpressionsOf(classNode)
  }

  isInstanceThisOf(expression, classNode) {
    return this.#index.isInstanceThisOf(expression, classNode)
  }

  instanceClassOf(expression) {
    return this.#index.instanceClassOf(expression)
  }

  #keepsInstancesOf(classNode) {
    return !this.#hasDynamicScope
      && Boolean(new BindingIdentifier(classNode).value)
      && !this.isExportedDeclaration(classNode)
      && hasConfinedThis(classNode, this)
      && this.referencesTo(classNode).every((reference) => keepsClassUse(reference.identifier, this))
  }
}

function moduleIndexFor(sourceCode) {
  if (!MODULE_INDEXES.has(sourceCode)) MODULE_INDEXES.set(sourceCode, new ModuleIndex(sourceCode))
  return MODULE_INDEXES.get(sourceCode)
}

class ModuleIndex {
  instanceResults = new Map()

  #sourceCode
  #cachedExportedVariables
  #cachedMemberReads
  #cachedThisBindings

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  get exportedVariables() {
    return this.#cachedExportedVariables ??= exportedVariablesIn(this.#sourceCode)
  }

  memberReadsFor(member, { owner, isStatic }) {
    return this.#memberReads.valuesFor(member, { owner, isStatic })
  }

  thisExpressionsOf(classNode) {
    return this.#thisBindings.expressionsOf(classNode)
  }

  isInstanceThisOf(expression, classNode) {
    return this.#thisBindings.isInstanceOf(expression, classNode)
  }

  instanceClassOf(expression) {
    return this.#thisBindings.instanceClassOf(expression)
  }

  get #memberReads() {
    return this.#cachedMemberReads ??= new MemberReads(this.#sourceCode, this.#thisBindings)
  }

  get #thisBindings() {
    return this.#cachedThisBindings ??= new ClassThisBindings(this.#sourceCode.ast)
  }
}

class ClassEvaluation {
  #evaluate
  #results
  #current
  #dependents = new Map()
  #pending = []
  #visited = new Set()
  #isRunning = false
  #isSuccessful = true

  constructor(evaluate, results) {
    this.#evaluate = evaluate
    this.#results = results
  }

  keeps(classNode) {
    const known = this.#knownResultFor(classNode)
    return this.#isRunning ? this.#nestedResultFor(classNode, known) : known ?? this.#isKeptFrom(classNode)
  }

  #knownResultFor(candidate) {
    return this.#results.has(candidate) ? this.#results.get(candidate) : null
  }

  #nestedResultFor(dependency, known) {
    this.#recordDependencyOn(dependency)
    if (known === null) this.#schedule(dependency)
    return known ?? true
  }

  #recordDependencyOn(dependency) {
    const dependents = this.#dependents.get(dependency) ?? new Set()
    dependents.add(this.#current)
    this.#dependents.set(dependency, dependents)
  }

  #schedule(candidate) {
    if (!this.#visited.has(candidate)) {
      this.#visited.add(candidate)
      this.#pending.push(candidate)
    }
  }

  #isKeptFrom(root) {
    this.#schedule(root)
    return this.#isKeptAfterRunning()
  }

  #isKeptAfterRunning() {
    this.#start()
    try {
      return this.#isEvaluationSuccessful
    } finally {
      this.#finish()
    }
  }

  #start() {
    this.#isRunning = true
    this.#resetSuccess()
  }

  #resetSuccess() {
    this.#isSuccessful = true
  }

  get #isEvaluationSuccessful() {
    while (this.#isSuccessful && this.#pending.length > 0) this.#evaluateNext()
    if (this.#isSuccessful) this.#visited.forEach((classNode) => this.#results.set(classNode, true))
    return this.#isSuccessful
  }

  #evaluateNext() {
    this.#current = this.#pending.pop()
    if (!this.#evaluate(this.#current)) this.#rememberFailureFrom(this.#current)
  }

  #rememberFailureFrom(failedClass) {
    const pending = [ failedClass ]
    const failed = new Set()
    while (pending.length > 0) this.#fail(pending.pop(), pending, failed)
    this.#isSuccessful = false
  }

  #fail(candidate, pending, failed) {
    if (failed.has(candidate)) return

    failed.add(candidate)
    this.#results.set(candidate, false)
    this.#dependents.get(candidate)?.forEach((dependent) => {
      pending.push(dependent)
    })
  }

  #finish() {
    this.#isRunning = false
    this.#clearDependencies()
    this.#clearTraversal()
  }

  #clearDependencies() {
    this.#current = null
    this.#dependents = new Map()
  }

  #clearTraversal() {
    this.#pending = []
    this.#visited = new Set()
  }
}

class BindingIdentifier {
  #node

  constructor(node) {
    this.#node = node
  }

  get value() {
    if (this.#node.parent?.type === "VariableDeclarator") return this.#declaratorIdentifier
    return this.#isDeclaration ? this.#node.id : null
  }

  get #declaratorIdentifier() {
    return this.#node.parent.id.type === "Identifier" ? this.#node.parent.id : null
  }

  get #isDeclaration() {
    return this.#node.type === "ClassDeclaration" || this.#node.type === "FunctionDeclaration"
  }
}

function hasConfinedThis(classNode, view) {
  return view.thisExpressionsOf(classNode).every((node) => staysAt(node, view))
}
