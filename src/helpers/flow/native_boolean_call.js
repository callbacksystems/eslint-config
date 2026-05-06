import { directMemberOf } from "#helpers/syntax/classes"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"
import { memberWriteOperationOf } from "#helpers/classes/member_write_targets"
import { NativeBooleanValue } from "#helpers/flow/native_boolean_value"
import { resolvedPublicMemberNameOf } from "#helpers/classes/resolved_member_key"
import { StableAliasGroups } from "#helpers/scope/stable_alias_groups"

const NATIVE_RECEIVER_POLICY = {}

export class NativeBooleanCall {
  #aliases
  #bindings
  #cachedMethod
  #cachedNativeValue
  #cachedReceiverValue
  #call
  #context
  #globals

  constructor(call, context) {
    this.#call = call
    this.#context = context
    this.#bindings = context.bindings
    this.#globals = new GlobalValueIdentity(this.#bindings)
  }

  get isBoolean() {
    if (this.#callee.type !== "MemberExpression") return false

    const method = this.#method
    if (!method) return false

    if (this.#isReflectHas) return true

    const receiverValue = this.#receiverValue
    return Boolean(receiverValue)
      && new NativeBooleanValue(receiverValue, this.#context).isBooleanAt(method, this.#callee)
  }

  get hasBooleanContract() {
    if (this.#callee.type !== "MemberExpression" || !this.#method) return false
    if (this.#isReflectHas) return true

    return this.#nativeValue?.hasBooleanContractAt(this.#method, this.#callee) === true
  }

  get #callee() {
    return this.#call.callee
  }

  get #method() {
    if (this.#cachedMethod === undefined) {
      this.#cachedMethod = resolvedPublicMemberNameOf(this.#callee, this.#bindings) ?? null
    }
    return this.#cachedMethod
  }

  get #isReflectHas() {
    return this.#method === "has" && this.#globals.matches(this.#callee, "Reflect", [ "has" ])
  }

  get #receiverValue() {
    if (this.#cachedReceiverValue === undefined) this.#cachedReceiverValue = this.#uncachedReceiverValue
    return this.#cachedReceiverValue
  }

  get #uncachedReceiverValue() {
    const { object } = this.#callee
    if (object.type !== "Identifier") return object
    if (new NativeBooleanValue(object, this.#context).isImmutableString) return object

    return new ConfinedNativeReceiver(object, {
      aliases: this.#receiverAliases,
      context: this.#context,
      target: this.#callee
    }).value
  }

  get #receiverAliases() {
    return this.#aliases ??= StableAliasGroups.for(this.#bindings.sourceCode, this.#bindings)
  }

  get #nativeValue() {
    if (this.#cachedNativeValue === undefined) {
      this.#cachedNativeValue = this.#receiverValue
        ? new NativeBooleanValue(this.#receiverValue, this.#context)
        : null
    }
    return this.#cachedNativeValue
  }
}

class ConfinedNativeReceiver {
  #aliases
  #context
  #identifier
  #target

  constructor(identifier, { aliases, context, target }) {
    this.#identifier = identifier
    this.#aliases = aliases
    this.#context = context
    this.#target = target
  }

  get value() {
    const group = this.#aliases.groupFor(this.#identifier)
    const reference = this.#aliases.referenceFor(this.#identifier)
    return group?.isConfinedAt({
      reference,
      policy: NATIVE_RECEIVER_POLICY,
      ignoredReference: reference,
      target: this.#target,
      isSafeReference: (reference) => new NativeReceiverReference(reference, group.root, this.#context).isSafe
    }) === true
      ? group.root
      : null
  }
}

class NativeReceiverReference {
  #context
  #reference
  #root

  constructor(reference, root, context) {
    this.#reference = reference
    this.#root = root
    this.#context = context
  }

  get isSafe() {
    return Boolean(this.#member) && !memberWriteOperationOf(this.#member) && Boolean(this.#method)
      && (this.#isSafeInvocation || this.#isSafeRead)
  }

  get #member() {
    return directMemberOf(this.#reference.identifier)
  }

  get #method() {
    return this.#member ? resolvedPublicMemberNameOf(this.#member, this.#context.bindings) : null
  }

  get #isSafeInvocation() {
    return this.#invocation?.callee === this.#member
      && new NativeBooleanValue(this.#root, this.#context).isReceiverSafeAt(this.#method, this.#invocation)
  }

  get #invocation() {
    return this.#member?.parent?.type === "CallExpression" ? this.#member.parent : null
  }

  get #isSafeRead() {
    return this.#invocation?.callee !== this.#member
      && new NativeBooleanValue(this.#root, this.#context).supportsRead(this.#method)
  }
}
