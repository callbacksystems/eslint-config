import { resolvedRuntimeMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"

export class MethodKey {
  static #byMember = new WeakMap()

  static from(member, bindings) {
    if (!this.#byMember.has(member)) {
      const key = resolvedRuntimeMemberKeyOf(member, { bindings, globals: new GlobalValueIdentity(bindings) })
      this.#byMember.set(member, key ? new MethodKey(key) : null)
    }
    return this.#byMember.get(member)
  }

  constructor(key) {
    this.value = key.pathMember ?? key.name
    this.isPrivate = key.node.type === "PrivateIdentifier"
    this.groupName = key.name
    this.name = this.#displayName
  }

  get #displayName() {
    if (typeof this.value === "symbol") return this.value.description ?? String(this.value)
    return this.isPrivate ? `#${this.value}` : this.value
  }
}
