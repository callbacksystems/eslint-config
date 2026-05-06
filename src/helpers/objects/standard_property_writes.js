import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"
import { CallInvocation } from "#helpers/objects/call_invocation"
import { PropertyWriteArguments } from "#helpers/objects/property_write_arguments"
import { standardPropertyWriteContractMatching } from "#helpers/objects/standard_property_write_contract"
import { isResolvedMemberKeyValid } from "#helpers/classes/resolved_member_key"

export class StandardPropertyWrites {
  #bindings
  #cachedArguments
  #cachedContract
  #globals
  #invocation

  constructor(call, bindings) {
    this.#bindings = bindings
    this.#globals = new GlobalValueIdentity(bindings)
    this.#invocation = new CallInvocation(call, bindings, {
      isReflectApply: (callee) => this.#globals.matches(callee, "Reflect", [ "apply" ])
    })
  }

  get values() {
    return this.#writeArguments?.values ?? []
  }

  hasTarget(node) {
    return this.#writeArguments?.target === node
  }

  hasEffectiveReceiver(node) {
    return this.#writeArguments?.hasEffectiveReceiver(node) === true
  }

  get #writeArguments() {
    if (this.#cachedArguments === undefined) {
      this.#cachedArguments = this.#contract
        ? new PropertyWriteArguments(this.#invocation.arguments, this.#contract, {
          bindings: this.#bindings,
          hasDefaultDescriptorPrototype: (target, globalName) =>
            this.#hasDefaultDescriptorPrototypeAt(target, globalName),
          isKeyValid: (key) => isResolvedMemberKeyValid(key, this.#globals)
        })
        : null
    }
    return this.#cachedArguments
  }

  get #contract() {
    if (this.#cachedContract === undefined) {
      this.#cachedContract = standardPropertyWriteContractMatching(({ globalName, memberName }) =>
        this.#globals.matches(this.#invocation.callee, globalName, [ memberName ])) ?? null
      if (this.#cachedContract && !this.#invocation.isExactFor(this.#globals, this.#cachedContract)) {
        this.#cachedContract = null
      }
    }
    return this.#cachedContract
  }

  #hasDefaultDescriptorPrototypeAt(target, globalName = "Object") {
    return [ "get", "set", "value" ].every((name) =>
      this.#globals.isAbsentAndUnmodifiedAt(target, globalName, [ "prototype", name ]))
  }
}
