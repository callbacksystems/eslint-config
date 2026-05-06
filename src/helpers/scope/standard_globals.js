import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"

export class StandardGlobals {
  #bindings
  #identity

  constructor(bindings) {
    this.#bindings = bindings
    this.#identity = new GlobalValueIdentity(bindings)
  }

  matches(node, globalName, members = []) {
    const captured = node?.type === "Identifier" ? this.#bindings.stableValueFor(node) : null
    return this.#identity.matches(captured ?? node, globalName, members)
  }
}
