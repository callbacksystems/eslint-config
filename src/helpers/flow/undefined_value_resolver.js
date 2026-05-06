export class UndefinedValueResolver {
  #bindings
  #values = new WeakMap()

  constructor(bindings) {
    this.#bindings = bindings
  }

  isDefinitelyUndefined(identifier) {
    return new UndefinedValueWalk(identifier, { bindings: this.#bindings, values: this.#values }).value
  }
}

class UndefinedValueWalk {
  #bindings
  #current
  #path = []
  #result = null
  #seen = new WeakSet()
  #values

  constructor(identifier, { bindings, values }) {
    this.#current = identifier
    this.#bindings = bindings
    this.#values = values
  }

  get value() {
    while (this.#current && this.#result === null) this.#advance()
    return this.#remember(this.#result ?? false)
  }

  #advance() {
    const binding = this.#bindings.variableFor(this.#current)
    const knownValue = this.#knownValueOf(binding)
    if (knownValue === null) this.#follow(binding)
    else this.#result = knownValue
  }

  #knownValueOf(binding) {
    if (this.#isGlobalUndefined) return true
    if (!binding || this.#seen.has(binding)) return false

    return this.#values.has(binding) ? this.#values.get(binding) : null
  }

  get #isGlobalUndefined() {
    return this.#current.name === "undefined" && this.#bindings.isUnmodifiedGlobal(this.#current)
  }

  #follow(binding) {
    this.#seen.add(binding)
    this.#path.push(binding)
    const value = new BoundValue(this.#current, { binding, bindings: this.#bindings })
    if (value.isDefinitelyUndefined) this.#result = true
    else this.#current = value.alias
  }

  #remember(value) {
    this.#path.forEach((binding) => this.#values.set(binding, value))
    return value
  }
}

class BoundValue {
  #binding
  #bindings
  #identifier
  #cachedDefinition

  constructor(identifier, { binding, bindings }) {
    this.#identifier = identifier
    this.#binding = binding
    this.#bindings = bindings
  }

  get isDefinitelyUndefined() {
    return this.#isStableVariable && (!this.#initializer || this.#isVoidInitializer)
  }

  get alias() {
    return this.#isStableVariable && this.#initializer?.type === "Identifier" ? this.#initializer : null
  }

  get #isStableVariable() {
    return this.#definition?.type === "Variable" && this.#bindings.isUnmodified(this.#identifier)
  }

  get #definition() {
    return this.#cachedDefinition ??= this.#binding.defs.length === 1 ? this.#binding.defs[0] : null
  }

  get #initializer() {
    return this.#definition?.node.init
  }

  get #isVoidInitializer() {
    return this.#initializer.type === "UnaryExpression" && this.#initializer.operator === "void"
  }
}
