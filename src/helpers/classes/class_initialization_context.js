import { classElementHolding, isClassNode } from "#helpers/syntax/classes"
import { contains } from "#helpers/syntax/ranges"
import { isFunction } from "#helpers/syntax/functions"

export class ClassInitializationContext {
  #access
  #classNode
  #cachedElement

  constructor(access, classNode) {
    this.#access = access
    this.#classNode = classNode
  }

  get directElement() {
    return this.isDeferred ? null : this.element
  }

  get isDeferred() {
    return Boolean(this.element) && this.#hasDeferredBoundary
  }

  get element() {
    if (this.#cachedElement === undefined) this.#cachedElement = this.#element
    return this.#cachedElement
  }

  get #hasDeferredBoundary() {
    let current = this.#access.parent
    while (this.#canAdvanceFrom(current)) current = current.parent
    return current !== this.element
  }

  #canAdvanceFrom(current) {
    return current !== this.element && !isDeferredBoundary(current)
  }

  get #element() {
    const element = classElementHolding(this.#access, this.#classNode)
    if (element?.type === "StaticBlock") return element
    return element?.type === "PropertyDefinition" && contains(element.value, this.#access) ? element : null
  }
}

function isDeferredBoundary(node) {
  return isFunction(node) || isClassNode(node)
}
