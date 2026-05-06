import { BindingDefinition } from "#helpers/scope/binding_definition"
import { isOnlyReferenceBefore } from "#helpers/scope/references"

export class ConstantReference {
  #binding
  #node

  constructor(node, bindings) {
    this.#node = node
    this.#binding = node.type === "Identifier" && !bindings.isDynamicallyResolved(node)
      ? bindings.variableFor(node)
      : null
    this.initializer = this.#initializer
  }

  isOnlyReferenceBefore(node) {
    return isOnlyReferenceBefore(this.#binding, { identifier: this.#node, before: node })
  }

  get #initializer() {
    const definition = new BindingDefinition(this.#binding?.defs.length === 1 ? this.#binding.defs[0] : null)
    return definition.isConstant ? definition.initializer : null
  }
}
