import { isClassNode } from "#helpers/syntax/classes"
import { isFunction } from "#helpers/syntax/functions"
import { isReassignment, referencesIn } from "#helpers/scope/references"
import { hasUnsafeDynamicLookup } from "#helpers/scope/dynamic_scope"
import { BindingTimeline } from "#helpers/scope/binding_timeline"
import { BindingValues } from "#helpers/scope/binding_values"

const RESOLVERS = new WeakMap()

export class BindingResolver {
  #lookup
  #facts
  #scopeManager
  #timeline
  #values

  static for(sourceCode) {
    if (!RESOLVERS.has(sourceCode)) RESOLVERS.set(sourceCode, new BindingResolver(sourceCode))
    return RESOLVERS.get(sourceCode)
  }

  constructor(sourceCode) {
    this.sourceCode = sourceCode
    this.#scopeManager = sourceCode.scopeManager
    this.#lookup = new BindingLookup(this.#scopeManager)
    this.#facts = new BindingFacts(this.#lookup, sourceCode)
  }

  classFor(identifier) {
    const value = this.stableValueFor(identifier)
    return isClassNode(value) ? value : null
  }

  stableValueFor(identifier) {
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
    const value = this.stableValueFor(identifier)
    return isFunction(value) ? value : null
  }

  globalNameFor(identifier) {
    if (this.isDynamicallyResolved(identifier)) return null

    const value = this.stableValueFor(identifier) ?? identifier
    return value.type === "Identifier" && this.isUnmodifiedGlobal(value) ? value.name : null
  }

  isDynamicallyResolved(identifier) {
    return this.#facts.isDynamicallyResolved(identifier)
  }

  isUnmodifiedGlobal(identifier) {
    return !this.#facts.isDynamicallyResolved(identifier)
      && this.#bindingTimeline.isOriginalGlobalAt(identifier, this.variableFor(identifier))
  }

  sharesBinding(first, second) {
    const firstVariable = this.variableFor(first)
    return Boolean(firstVariable) && firstVariable === this.variableFor(second)
  }

  isUnmodified(identifier) {
    const variable = this.variableFor(identifier)
    return Boolean(variable) && !this.#facts.isDynamicallyResolved(identifier)
      && this.#facts.isUnmodified(variable)
  }

  isReassignment(identifier) {
    return this.#lookup.isReassignment(identifier)
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
    return this.#cachedReferences ??= referencesIn(this.#scopeManager)
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
