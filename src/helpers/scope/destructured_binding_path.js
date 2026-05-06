import { resolvedStringKeyOf } from "#helpers/syntax/resolved_string_key"

export class DestructuredBindingPath {
  #bindings
  #definition
  #identifier

  constructor(identifier, bindings) {
    this.#identifier = identifier
    this.#bindings = bindings
    this.#definition = bindings.definitionFor(identifier)
  }

  get value() {
    if (this.#isDestructuredVariable) {
      const { members } = new BindingPatternWalk(this.#definition, this.#bindings)
      return members ? { members, root: this.#definition.node.init } : null
    } else {
      return null
    }
  }

  get #isDestructuredVariable() {
    return this.#definition?.type === "Variable"
      && this.#definition.name === this.#bindings.variableFor(this.#identifier)?.identifiers[0]
      && this.#definition.node.id.type === "ObjectPattern"
  }
}

class BindingPatternWalk {
  #bindings
  #current
  #root
  #values = []

  constructor(definition, bindings) {
    this.#current = definition.name
    this.#root = definition.node.id
    this.#bindings = bindings
  }

  get members() {
    while (this.#current !== this.#root && this.#canAdvance) this.#advance()
    return this.#current === this.#root ? this.#values : null
  }

  get #canAdvance() {
    return this.#property?.type === "Property" && this.#property.value === this.#current
      && this.#property.kind === "init" && this.#name !== null
  }

  get #property() {
    return this.#current.parent
  }

  get #name() {
    return this.#property ? resolvedStringKeyOf(this.#property, this.#bindings)?.name ?? null : null
  }

  #advance() {
    this.#values.unshift(this.#name)
    this.#current = this.#property.parent
  }
}
