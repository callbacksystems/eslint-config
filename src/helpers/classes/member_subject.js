import { isFunction } from "#helpers/syntax/functions"
import { isClassMember, staticMemberKeyOf } from "#helpers/syntax/classes"
import { resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"

export class MemberSubject {
  #node
  #bindings

  constructor(node, bindings = null) {
    this.#node = node
    this.#bindings = bindings
  }

  get name() {
    return this.#isMember ? this.#memberKey?.name ?? null : this.#node.id?.name ?? null
  }

  get nameNode() {
    return this.#isMember ? this.#memberKey?.node ?? this.#node.key : this.#node.id
  }

  get functionNode() {
    return this.#isMember ? this.#node.value : this.#node
  }

  get isEligible() {
    return this.#isMember ? this.#isCheckableMember : Boolean(this.#node.id)
  }

  get #isMember() {
    return isClassMember(this.#node)
  }

  get #memberKey() {
    return this.#bindings ? resolvedMemberKeyOf(this.#node, this.#bindings) : staticMemberKeyOf(this.#node)
  }

  get #isCheckableMember() {
    const { kind, value } = this.#node
    return kind !== "constructor"
      && Boolean(this.#memberKey)
      && this.#hasNameableKey
      && isFunction(value)
  }

  get #hasNameableKey() {
    const { node } = this.#memberKey
    return node.type === "Identifier" || node.type === "PrivateIdentifier"
      || typeof node.value === "string" || node.type === "TemplateLiteral"
  }
}
