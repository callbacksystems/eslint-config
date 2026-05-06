import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"
import { StableAliasGroups } from "#helpers/scope/stable_alias_groups"
import { resolvedPublicMemberNameOf } from "#helpers/classes/resolved_member_key"

const REGEXP_LITERAL_POLICY = {}

export class ExactRegexpLiteral {
  #aliases
  #bindings
  #node
  #value

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
    this.#value = node?.type === "Identifier" ? bindings.stableValueFor(node) ?? node : node
  }

  get isPresent() {
    if (!isRegexpLiteral(this.#value)) return false
    if (this.#node === this.#value) return true

    const reference = this.#aliasGroups.referenceFor(this.#node)
    return this.#aliasGroups.groupFor(this.#node)?.isConfinedAt({
      reference,
      ignoredReference: reference,
      isSafeReference: (candidate) => new SafeRegexpReference(candidate.identifier, this.#bindings).isPresent,
      policy: REGEXP_LITERAL_POLICY,
      target: this.#node
    }) === true
  }

  get #aliasGroups() {
    return this.#aliases ??= StableAliasGroups.for(this.#bindings.sourceCode, this.#bindings)
  }
}

function isRegexpLiteral(node) {
  return node?.type === "Literal" && Boolean(node.regex)
}

class SafeRegexpReference {
  #bindings
  #globals
  #identifier

  constructor(identifier, bindings) {
    this.#identifier = identifier
    this.#bindings = bindings
    this.#globals = new GlobalValueIdentity(bindings)
  }

  get isPresent() {
    return this.#isDirectTest || this.#isTestAfterConversion
  }

  get #isDirectTest() {
    return this.#member?.object === this.#identifier && this.#isNativeTest(this.#member)
  }

  get #member() {
    return this.#identifier.parent?.type === "MemberExpression" ? this.#identifier.parent : null
  }

  #isNativeTest(member) {
    const call = memberInvocationOf(member)
    return Boolean(call) && resolvedPublicMemberNameOf(member, this.#bindings) === "test"
      && this.#globals.isIntrinsicUnmodifiedAt(member, "RegExp", [ "prototype", "test" ])
      && this.#globals.isIntrinsicUnmodifiedAt(call, "RegExp", [ "prototype", "exec" ])
  }

  get #isTestAfterConversion() {
    const conversion = this.#identifier.parent
    return [ "CallExpression", "NewExpression" ].includes(conversion?.type)
      && conversion.arguments[0] === this.#identifier
      && this.#globals.matches(conversion.callee, "RegExp")
      && this.#isNativeTest(conversion.parent)
  }
}

function memberInvocationOf(member) {
  if (member?.type !== "MemberExpression") return null

  const call = member.parent
  if (call?.type !== "CallExpression") return null
  return !call.optional && call.callee === member ? call : null
}
