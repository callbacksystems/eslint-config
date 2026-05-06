export class ResourceDisposal {
  #node
  #undefinedValues

  constructor(node, { undefinedValues = null } = {}) {
    this.#node = node
    this.#undefinedValues = undefinedValues
  }

  get canCallUserCode() {
    return this.#isResourceDeclaration
      && this.#node.declarations.some(({ init }) => !this.#isDefinitelyNullish(init))
  }

  get #isResourceDeclaration() {
    return this.#node.type === "VariableDeclaration" && [ "using", "await using" ].includes(this.#node.kind)
  }

  #isDefinitelyNullish(node) {
    switch (node?.type) {
      case "Literal": return node.value === null
      case "Identifier": return this.#undefinedValues?.isDefinitelyUndefined(node) === true
      case "UnaryExpression": return node.operator === "void"
      default: return false
    }
  }
}
