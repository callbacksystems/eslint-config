export class FunctionSubject {
  #node
  #view

  constructor(node, view) {
    this.#node = node
    this.#view = view
  }

  get nameNode() {
    return this.#node.id
  }

  get params() {
    return this.#node.params
  }

  get body() {
    return this.#node.body
  }

  get functionNode() {
    return this.#node
  }

  get isEligible() {
    return Boolean(this.name) && !this.#node.async && !this.#node.generator
      && !this.#view.isExportedDeclaration(this.#node)
  }

  get name() {
    return this.#node.id?.name ?? null
  }
}
