import { resolvedPublicMemberNameOf } from "#helpers/classes/resolved_member_key"

export class CallInvocation {
  #bindings
  #call
  #isReflectApply

  constructor(call, bindings, { isReflectApply = () => false } = {}) {
    this.#call = call
    this.#bindings = bindings
    this.#isReflectApply = isReflectApply
  }

  get arguments() {
    if (this.#isCallForwarded) return this.#call.arguments.slice(1)
    if (this.#isApplyForwarded) return this.#call.arguments[1].elements
    return this.#isReflectForwarded ? this.#call.arguments[2].elements : this.#call.arguments
  }

  get callee() {
    if (this.#isCallForwarded || this.#isApplyForwarded) return this.#call.callee.object
    return this.#isReflectForwarded ? this.#call.arguments[0] : this.#call.callee
  }

  isExactFor(globals, contract) {
    if (this.#isCallForwarded) return this.#hasExactFunctionForwarder(globals, contract, "call")
    if (this.#isApplyForwarded) return this.#hasExactFunctionForwarder(globals, contract, "apply")
    return !this.#isReflectForwarded || globals.isUnmodifiedAt(this.#call.callee, "Reflect", [ "apply" ])
  }

  get #isCallForwarded() {
    return this.#call.callee.type === "MemberExpression" && !isSpreadElement(this.#call.arguments[0])
      && resolvedPublicMemberNameOf(this.#call.callee, this.#bindings) === "call"
  }

  get #isApplyForwarded() {
    return this.#call.callee.type === "MemberExpression"
      && resolvedPublicMemberNameOf(this.#call.callee, this.#bindings) === "apply"
      && this.#call.arguments[1]?.type === "ArrayExpression"
      && this.#call.arguments.slice(0, 2).every(isPlainArgument)
      && this.#call.arguments[1].elements.every(isPlainArgument)
  }

  get #isReflectForwarded() {
    return this.#isReflectApply(this.#call.callee) && this.#call.arguments[2]?.type === "ArrayExpression"
      && this.#call.arguments.slice(0, 3).every(isPlainArgument)
  }

  #hasExactFunctionForwarder(globals, { globalName, memberName }, forwarder) {
    return globals.isUnmodifiedAt(this.#call.callee, globalName, [ memberName, forwarder ])
      && globals.isIntrinsicUnmodifiedAt(this.#call.callee, "Function", [ "prototype", forwarder ])
  }
}

function isSpreadElement(argument) {
  return argument?.type === "SpreadElement"
}

function isPlainArgument(argument) {
  return !isSpreadElement(argument)
}
