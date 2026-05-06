import { memberName } from "#helpers/syntax/classes"

export class MethodSubject {
  #node

  constructor(node) {
    this.#node = node
  }

  get nameNode() {
    return this.#node.key
  }

  get name() {
    return memberName(this.#node)
  }

  get params() {
    return this.#node.value.params
  }

  get body() {
    return this.#node.value.body
  }

  get functionNode() {
    return this.#node.value
  }

  get definitionNode() {
    return this.#node
  }

  get kind() {
    return this.#node.kind
  }

  get isPrivate() {
    return this.#node.key.type === "PrivateIdentifier"
  }

  get isAsync() {
    return this.#node.value.async
  }

  get isGenerator() {
    return this.#node.value.generator
  }
}
