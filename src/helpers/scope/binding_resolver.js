import { isClassNode } from "#helpers/syntax/classes"
import { isFunction } from "#helpers/syntax/functions"
import { isReassignment } from "#helpers/scope/references"
import { hasUnsafeDynamicLookup } from "#helpers/scope/dynamic_scope"
import { BindingTimeline } from "#helpers/scope/binding_timeline"
import { BindingValues } from "#helpers/scope/binding_values"

const INDEXES = new WeakMap()

export class BindingResolver {
  #index

  constructor(sourceCode) {
    if (!INDEXES.has(sourceCode)) INDEXES.set(sourceCode, new BindingIndex(sourceCode))
    this.#index = INDEXES.get(sourceCode)
    this.sourceCode = sourceCode
  }

  classFor(identifier) {
    return this.#index.classFor(identifier)
  }

  constantInitializerFor(identifier) {
    return this.#index.constantInitializerFor(identifier)
  }

  definitionFor(identifier) {
    return this.#index.definitionFor(identifier)
  }

  functionFor(identifier) {
    return this.#index.functionFor(identifier)
  }

  globalNameFor(identifier) {
    if (this.#index.isDynamicallyResolved(identifier)) return null

    const value = this.#index.valueFor(identifier) ?? identifier
    return value.type === "Identifier" && this.isUnmodifiedGlobal(value) ? value.name : null
  }

  isUnmodifiedGlobal(identifier) {
    return this.#index.isUnmodifiedGlobal(identifier)
  }

  stableValueFor(identifier) {
    return this.#index.valueFor(identifier)
  }

  isUnmodified(identifier) {
    return this.#index.isUnmodified(identifier)
  }

  isReassignment(identifier) {
    return this.#index.isReassignment(identifier)
  }

  isDynamicallyResolved(identifier) {
    return this.#index.isDynamicallyResolved(identifier)
  }

  isImmutableValue(identifier) {
    return this.#index.isImmutableValue(identifier)
  }

  sharesBinding(first, second) {
    const firstVariable = this.variableFor(first)
    return Boolean(firstVariable) && firstVariable === this.variableFor(second)
  }

  variableFor(identifier) {
    return this.#index.variableFor(identifier)
  }
}

class BindingIndex {
  #lookup
  #facts
  #scopeManager
  #timeline
  #values

  constructor(sourceCode) {
    this.#scopeManager = sourceCode.scopeManager
    this.#lookup = new BindingLookup(this.#scopeManager)
    this.#facts = new BindingFacts(this.#lookup, sourceCode)
  }

  classFor(identifier) {
    const value = this.valueFor(identifier)
    return isClassNode(value) ? value : null
  }

  valueFor(identifier) {
    return this.#bindingValues.valueAt(identifier)
  }

  constantInitializerFor(identifier) {
    return this.#bindingValues.constantInitializerAt(identifier)
  }

  definitionFor(identifier) {
    if (this.#facts.isDynamicallyResolved(identifier)) return null

    const variable = this.variableFor(identifier)
    return variable ? this.#bindingTimeline.definitionAt(identifier, variable) : null
  }

  variableFor(identifier) {
    return this.#lookup.variableFor(identifier)
  }

  functionFor(identifier) {
    const value = this.valueFor(identifier)
    return isFunction(value) ? value : null
  }

  isUnmodifiedGlobal(identifier) {
    return !this.#facts.isDynamicallyResolved(identifier)
      && this.#bindingTimeline.isOriginalGlobalAt(identifier, this.variableFor(identifier))
  }

  isUnmodified(identifier) {
    const variable = this.variableFor(identifier)
    return Boolean(variable) && !this.#facts.isDynamicallyResolved(identifier)
      && this.#facts.isUnmodified(variable)
  }

  isReassignment(identifier) {
    return this.#lookup.isReassignment(identifier)
  }

  isDynamicallyResolved(identifier) {
    return this.#facts.isDynamicallyResolved(identifier)
  }

  isImmutableValue(identifier) {
    return this.#bindingValues.isImmutableAt(identifier)
  }

  get #bindingValues() {
    return this.#values ??= new BindingValues(this.#facts, this.#bindingTimeline)
  }

  get #bindingTimeline() {
    return this.#timeline ??= new BindingTimeline(this.#scopeManager)
  }
}

class BindingLookup {
  #scopeManager
  #cachedReferences
  #cachedDeclarations

  constructor(scopeManager) {
    this.#scopeManager = scopeManager
  }

  variableFor(identifier) {
    return this.#references.get(identifier)?.resolved ?? this.#declarations.get(identifier) ?? null
  }

  isTainted(identifier) {
    return this.#references.get(identifier)?.tainted ?? false
  }

  isReassignment(identifier) {
    const reference = this.#references.get(identifier)
    return Boolean(reference) && isReassignment(reference)
  }

  get #references() {
    return this.#cachedReferences ??= new Map(this.#scopeManager.scopes
      .flatMap((scope) => scope.references)
      .map((reference) => [ reference.identifier, reference ]))
  }

  get #declarations() {
    return this.#cachedDeclarations ??= new Map(this.#scopeManager.scopes.toReversed()
      .flatMap((scope) => scope.variables)
      .flatMap((variable) => variable.identifiers.map((identifier) => [ identifier, variable ])))
  }
}

class BindingFacts {
  #dynamicResolutions = new WeakMap()
  #lookup
  #sourceCode
  #stableDefinitions = new WeakMap()
  #unmodifiedBindings = new WeakMap()

  constructor(lookup, sourceCode) {
    this.#lookup = lookup
    this.#sourceCode = sourceCode
  }

  stableDefinitionOf(variable) {
    if (!this.#stableDefinitions.has(variable)) {
      this.#stableDefinitions.set(variable,
        variable.defs.length === 1 && this.isUnmodified(variable) ? variable.defs[0] : null)
    }
    return this.#stableDefinitions.get(variable)
  }

  isUnmodified(variable) {
    if (!this.#unmodifiedBindings.has(variable)) {
      this.#unmodifiedBindings.set(variable, !variable.references.some(isReassignment))
    }
    return this.#unmodifiedBindings.get(variable)
  }

  isDynamicallyResolved(identifier) {
    if (identifier && !this.#dynamicResolutions.has(identifier)) {
      this.#dynamicResolutions.set(identifier, this.#lookup.isTainted(identifier)
      || hasUnsafeDynamicLookup(this.#sourceCode, identifier, this.#lookup.variableFor(identifier)))
    }
    return identifier ? this.#dynamicResolutions.get(identifier) : false
  }

  variableFor(identifier) {
    return this.#lookup.variableFor(identifier)
  }
}
