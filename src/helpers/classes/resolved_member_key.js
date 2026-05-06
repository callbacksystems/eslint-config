import { resolvedStringKeyOf } from "#helpers/syntax/resolved_string_key"
import { wellKnownSymbolKeyOf } from "#helpers/syntax/well_known_symbol"

export function resolvedMemberKeyOf(member, bindings) {
  return new ResolvedMemberKey(member, bindings).value
}

export function isResolvedMemberKeyValid(key, globals) {
  return Boolean(key) && (key.pathGuards ?? []).every(({ globalName, members, target }) =>
    globals.isUnmodifiedAt(target, globalName, members))
}

export function resolvedRuntimeMemberKeyOf(member, { bindings, globals }) {
  const key = resolvedMemberKeyOf(member, bindings)
  return isResolvedMemberKeyValid(key, globals) ? key : null
}

export function resolvedRuntimePropertyKeyOf(member, options) {
  const key = resolvedRuntimeMemberKeyOf(member, options)
  return key?.pathMember ?? key?.name ?? null
}

export function resolvedPublicMemberNameOf(member, bindings) {
  const key = resolvedMemberKeyOf(member, bindings)
  return key?.node.type === "PrivateIdentifier" ? null : key?.name ?? null
}

class ResolvedMemberKey {
  #bindings
  #member

  constructor(member, bindings) {
    this.#bindings = bindings
    this.#member = member
  }

  get value() {
    return resolvedStringKeyOf(this.#member, this.#bindings) ?? this.#computedSymbol
  }

  get #computedSymbol() {
    return this.#member.computed
      ? wellKnownSymbolKeyOf(this.#key, this.#bindings)
      : null
  }

  get #key() {
    return this.#member.key ?? this.#member.property
  }
}
