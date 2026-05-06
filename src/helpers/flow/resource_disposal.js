import { isResourceDeclaration } from "#helpers/syntax/ast"

export class ResourceDisposal {
  #node
  #undefinedValues

  constructor(node, { undefinedValues = null } = {}) {
    this.#node = node
    this.#undefinedValues = undefinedValues
  }

  get canCallUserCode() {
    return isResourceDeclaration(this.#node)
      && this.#node.declarations.some(({ init }) => !this.#isDefinitelyNullish(init))
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
