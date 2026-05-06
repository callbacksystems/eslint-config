import { resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"

const DIRECT_VALUE_TYPES = new Set([ "ArrayExpression", "Identifier", "Literal", "ObjectExpression" ])

export class ResolvedObjectProperty {
  #keyOptions
  #node

  constructor(node, keyOptions) {
    this.#node = node
    this.#keyOptions = keyOptions
  }

  get writeName() {
    return this.#key?.pathMember ?? this.#key?.name ?? null
  }

  get isPrototypeSetter() {
    return !this.#node.computed && !this.#node.method && !this.#node.shorthand
      && this.#node.kind === "init" && this.#key?.name === "__proto__"
  }

  get isAccessorOrMethod() {
    return this.#node.kind !== "init" || this.#node.method
  }

  get writtenValue() {
    return this.#isQuietData ? this.value : null
  }

  get value() {
    return this.#node.value
  }

  get canReplaceDescriptorValue() {
    return this.#key === null || (this.#key.name !== null && [ "get", "set", "value" ].includes(this.#key.name))
      || !this.#isQuietData
  }

  get #key() {
    const key = resolvedMemberKeyOf(this.#node, this.#keyOptions.bindings)
    return this.#keyOptions.isKeyValid(key) ? key : null
  }

  get #isQuietData() {
    return this.#node.kind === "init" && !this.#node.method
      && DIRECT_VALUE_TYPES.has(this.#node.value.type)
  }
}
