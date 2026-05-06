import { ResolutionCache } from "#helpers/scope/resolution_cache"

const VALUE_BY_DEFINITION_TYPE = {
  ClassName: (definition) => definition.node,
  FunctionName: (definition) => definition.node,
  Variable: (definition) => definition.node.id.type === "Identifier" ? definition.node.init : null
}

export class BindingValues {
  #constantInitializers
  #facts
  #immutableValues
  #resolvedValues
  #timeline
  #valuesAt = new WeakMap()

  constructor(facts, timeline) {
    this.#facts = facts
    this.#timeline = timeline
    this.#resolvedValues = new ResolutionCache(new ResolvedValueSteps(facts, timeline), null)
    this.#immutableValues = new ResolutionCache(new ImmutableValueSteps(facts, timeline), false)
    this.#constantInitializers = new ResolutionCache(new ConstantInitializerSteps(facts, timeline), null)
  }

  valueAt(identifier) {
    if (this.#facts.isDynamicallyResolved(identifier)) return null

    if (!this.#valuesAt.has(identifier)) this.#valuesAt.set(identifier, this.#resolvedValueAt(identifier))
    return this.#valuesAt.get(identifier)
  }

  constantInitializerAt(identifier) {
    if (this.#facts.isDynamicallyResolved(identifier)) return null

    const variable = this.#facts.variableFor(identifier)
    return this.#hasStableDefinitionAt(identifier, variable)
      ? this.#constantInitializers.valueFrom(variable)
      : null
  }

  isImmutableAt(identifier) {
    if (this.#facts.isDynamicallyResolved(identifier)) return false

    const variable = this.#facts.variableFor(identifier)
    return this.#hasStableDefinitionAt(identifier, variable)
      && this.#immutableValues.valueFrom(variable)
  }

  #resolvedValueAt(identifier) {
    const variable = this.#facts.variableFor(identifier)
    return this.#hasStableDefinitionAt(identifier, variable)
      ? this.#resolvedValues.valueFrom(variable)
      : new ResolvedValueAt(identifier, this.#facts, this.#timeline).value
  }

  #hasStableDefinitionAt(identifier, variable) {
    const definition = variable && this.#facts.stableDefinitionOf(variable)
    return Boolean(definition) && (variable.identifiers.includes(identifier)
      || this.#timeline.definitionAt(identifier, variable) === definition)
  }
}

class ResolvedValueSteps {
  #facts
  #timeline

  constructor(facts, timeline) {
    this.#facts = facts
    this.#timeline = timeline
  }

  stepFrom(variable) {
    const { value } = new DefinitionValue(this.#facts.stableDefinitionOf(variable))
    return value?.type === "Identifier" ? this.#identifierStepFrom(value) : ResolutionCache.final(value)
  }

  #identifierStepFrom(identifier) {
    if (this.#facts.isDynamicallyResolved(identifier)) return ResolutionCache.final(null)

    const variable = this.#facts.variableFor(identifier)
    if (!variable || this.#timeline.isGlobalBinding(variable)) return ResolutionCache.final(identifier)

    const definition = this.#facts.stableDefinitionOf(variable)
    return definition && this.#timeline.definitionAt(identifier, variable) === definition
      ? ResolutionCache.following(variable)
      : ResolutionCache.final(new ResolvedValueAt(identifier, this.#facts, this.#timeline).value)
  }
}

class DefinitionValue {
  #definition

  constructor(definition) {
    this.#definition = definition
  }

  get value() {
    return VALUE_BY_DEFINITION_TYPE[this.#definition?.type]?.(this.#definition) ?? null
  }
}

class ResolvedValueAt {
  #current
  #facts
  #seen = new WeakSet()
  #steps = 0
  #timeline

  constructor(identifier, facts, timeline) {
    this.#current = identifier
    this.#facts = facts
    this.#timeline = timeline
  }

  get value() {
    while (this.#current?.type === "Identifier" && this.#canAdvance) this.#advance()
    return this.#current?.type === "Identifier" ? this.#endingValue : this.#current
  }

  get #canAdvance() {
    return this.#isStaticallyBound && !this.#isGlobalReference && !this.#seen.has(this.#current)
  }

  get #isStaticallyBound() {
    return !this.#facts.isDynamicallyResolved(this.#current) && Boolean(this.#variable)
  }

  get #variable() {
    return this.#facts.variableFor(this.#current)
  }

  get #isGlobalReference() {
    return this.#timeline.isGlobalBinding(this.#variable)
  }

  #advance() {
    this.#seen.add(this.#current)
    this.#steps += 1
    this.#current = this.#timeline.assignmentAt(this.#current, this.#variable)
      ?? new DefinitionValue(this.#timeline.definitionAt(this.#current, this.#variable)).value
  }

  get #endingValue() {
    return this.#isGlobalOrUnresolvedAlias && this.#steps > 0 ? this.#current : null
  }

  get #isGlobalOrUnresolvedAlias() {
    return !this.#facts.isDynamicallyResolved(this.#current)
      && (!this.#variable || this.#isGlobalReference)
  }
}

class ImmutableValueSteps {
  #facts
  #timeline

  constructor(facts, timeline) {
    this.#facts = facts
    this.#timeline = timeline
  }

  stepFrom(variable) {
    const constant = new StableConstant(this.#facts.stableDefinitionOf(variable))
    return constant.isPresent ? this.#stepFrom(constant.initializer) : ResolutionCache.final(false)
  }

  #stepFrom(initializer) {
    return initializer?.type === "Identifier"
      ? this.#identifierStepFrom(initializer)
      : ResolutionCache.final(true)
  }

  #identifierStepFrom(identifier) {
    if (this.#facts.isDynamicallyResolved(identifier)) return ResolutionCache.final(false)

    const variable = this.#facts.variableFor(identifier)
    if (variable) {
      const definition = this.#facts.stableDefinitionOf(variable)
      return definition && this.#timeline.definitionAt(identifier, variable) === definition
        ? ResolutionCache.following(variable)
        : ResolutionCache.final(false)
    } else {
      return ResolutionCache.final(true)
    }
  }
}

class StableConstant {
  #definition

  constructor(definition) {
    this.#definition = definition
  }

  get isPresent() {
    return this.#definition?.type === "Variable"
      && this.#definition.node.id.type === "Identifier"
      && this.#definition.parent.kind === "const"
  }

  get initializer() {
    return this.#definition.node.init
  }
}

class ConstantInitializerSteps {
  #facts
  #timeline

  constructor(facts, timeline) {
    this.#facts = facts
    this.#timeline = timeline
  }

  stepFrom(variable) {
    const constant = new StableConstant(this.#facts.stableDefinitionOf(variable))
    return constant.isPresent ? this.#stepFrom(constant.initializer) : ResolutionCache.final(null)
  }

  #stepFrom(initializer) {
    if (initializer?.type !== "Identifier") return ResolutionCache.final(initializer)

    if (this.#facts.isDynamicallyResolved(initializer)) return ResolutionCache.final(null)

    const variable = this.#facts.variableFor(initializer)
    const definition = variable && this.#facts.stableDefinitionOf(variable)
    return definition && this.#timeline.definitionAt(initializer, variable) === definition
      ? ResolutionCache.following(variable)
      : ResolutionCache.final(null)
  }
}
