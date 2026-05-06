// A named method, getter, or function-valued field or function, wrapped so a
// naming rule can ask the same questions of any of them: its name, the node to
// report on, the function carrying the body, and whether it is worth checking.

import { isFunction } from "#helpers/ast"

export class MemberSubject {
  #node

  constructor(node) {
    this.#node = node
  }

  get name() {
    return this.nameNode?.name ?? ""
  }

  get nameNode() {
    return this.#isMember ? this.#node.key : this.#node.id
  }

  get functionNode() {
    return this.#isMember ? this.#node.value : this.#node
  }

  get isEligible() {
    return this.#isMember ? this.#isCheckableMember : Boolean(this.#node.id)
  }

  get #isMember() {
    return this.#node.type === "MethodDefinition" || this.#node.type === "PropertyDefinition"
  }

  get #isCheckableMember() {
    const { key, kind, value } = this.#node
    return kind !== "constructor"
      && (key.type === "Identifier" || key.type === "PrivateIdentifier")
      && isFunction(value)
  }
}
