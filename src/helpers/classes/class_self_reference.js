export class ClassSelfReference {
  #classNode
  #node

  constructor(node, classNode) {
    this.#node = node
    this.#classNode = classNode
  }

  get isAfterInitialization() {
    const element = this.#element
    return element?.type === "StaticBlock" || (Boolean(element?.value) && this.#branchIn(element) === element.value)
  }

  get #element() {
    let current = this.#node
    while (current?.parent && current.parent !== this.#classNode.body) current = current.parent
    return current?.parent === this.#classNode.body ? current : null
  }

  #branchIn(element) {
    let current = this.#node
    while (current?.parent && current.parent !== element) current = current.parent
    return current?.parent === element ? current : null
  }
}
