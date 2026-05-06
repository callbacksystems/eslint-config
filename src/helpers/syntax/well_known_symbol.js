import { BindingDefinition } from "#helpers/scope/binding_definition"
import { DestructuredBindingPath } from "#helpers/scope/destructured_binding_path"
import { staticMemberKeyOf } from "#helpers/syntax/classes"
import { staticStringValueOf } from "#helpers/syntax/literals"

const SYMBOLS_BY_NAME = new Map(Object.entries(Object.getOwnPropertyDescriptors(Symbol))
  .filter(([ , descriptor ]) => isWellKnownSymbolDescriptor(descriptor))
  .map(([ name, descriptor ]) => [ name, descriptor.value ]))

export function wellKnownSymbolKeyOf(node, bindings) {
  const { key } = new WellKnownSymbolValue(node, bindings)
  return key === null
    ? null
    : { node, pathMember: key.value, name: null,
      pathGuards: [ { globalName: "Symbol", members: [], target: key.symbolNode } ] }
}

function isWellKnownSymbolDescriptor(descriptor) {
  return typeof descriptor.value === "symbol" && !descriptor.writable
    && !descriptor.enumerable && !descriptor.configurable
}

class WellKnownSymbolValue {
  #bindings
  #node

  constructor(node, bindings) {
    this.#bindings = bindings
    this.#node = node
  }

  get key() {
    const resolved = this.#resolvedValueFrom(this.#node)
    if (resolved?.type === "MemberExpression") return this.#keyFromMember(resolved)
    return resolved?.type === "Identifier" ? this.#keyFromDestructuring(resolved) : null
  }

  #resolvedValueFrom(node) {
    return new StableAlias(node, this.#bindings).value
  }

  #keyFromMember(member) {
    const name = this.#memberNameOf(member)
    return name === null ? null : this.#keyFrom(member.object, name)
  }

  #memberNameOf(member) {
    const staticName = staticMemberKeyOf(member)?.name
    if (staticName !== undefined) return staticName

    const { property } = member
    return member.computed && property.type === "Identifier"
      ? staticStringValueOf(this.#bindings.stableValueFor(property))
      : null
  }

  #keyFrom(object, name) {
    const symbolNode = this.#symbolConstructorOf(object)
    const value = SYMBOLS_BY_NAME.get(name) ?? null
    return symbolNode && value !== null ? { symbolNode, value } : null
  }

  #symbolConstructorOf(node) {
    const resolved = this.#resolvedValueFrom(node)
    return resolved?.type === "Identifier" && this.#bindings.globalNameFor(resolved) === "Symbol"
      ? resolved
      : null
  }

  #keyFromDestructuring(identifier) {
    const path = new DestructuredBindingPath(identifier, this.#bindings).value
    return path?.members.length === 1 ? this.#keyFrom(path.root, path.members[0]) : null
  }
}

class StableAlias {
  #bindings
  #current
  #seen = new Set()

  constructor(node, bindings) {
    this.#bindings = bindings
    this.#current = unwrappedNode(node)
  }

  get value() {
    while (this.#canAdvance) this.#advance()
    return this.#current
  }

  get #canAdvance() {
    return this.#current?.type === "Identifier"
      ? !this.#seen.has(this.#current) && this.#bindings.globalNameFor(this.#current) === null
      : false
  }

  #advance() {
    this.#seen.add(this.#current)
    const stableValue = this.#bindings.stableValueFor(this.#current)
      ?? new SimpleConstant(this.#current, this.#bindings).initializer
    this.#current = unwrappedNode(stableValue) ?? this.#current
  }
}

function unwrappedNode(node) {
  return node?.type === "ChainExpression" ? node.expression : node
}

class SimpleConstant {
  #bindings
  #identifier

  constructor(identifier, bindings) {
    this.#identifier = identifier
    this.#bindings = bindings
  }

  get initializer() {
    const definition = this.#bindings.definitionFor(this.#identifier)
    return new BindingDefinition(definition).isSimpleConstant ? definition.node.init : null
  }
}
