import { ObjectValueConfinement } from "#helpers/objects/object_value_confinement"

export class PropertySourceValue {
  node = null

  constructor(node, bindings, { requiresUnexposedObject = false } = {}) {
    this.node = new SourceResolution(node, bindings, { requiresUnexposedObject }).value
  }

  get hasOnlyIndexedEnumerableProperties() {
    return this.node?.type === "ArrayExpression" || this.#isStringPrimitive
  }

  get hasNoEnumerableOwnProperties() {
    return (this.isPrimitive && !this.#isStringPrimitive) || this.isRegExpLiteral
  }

  get isPrimitive() {
    return (this.node?.type === "Literal" && !this.isRegExpLiteral)
      || this.node?.type === "UnaryExpression" || this.node?.type === "TemplateLiteral"
  }

  get isRegExpLiteral() {
    return this.node?.type === "Literal" && Boolean(this.node.regex)
  }

  get isNullLiteral() {
    return this.node?.type === "Literal" && this.node.value === null
  }

  get #isStringPrimitive() {
    return (this.node?.type === "Literal" && typeof this.node.value === "string")
      || this.node?.type === "TemplateLiteral"
  }
}

class SourceResolution {
  #bindings
  #node
  #requiresUnexposedObject
  #resolved

  constructor(node, bindings, { requiresUnexposedObject }) {
    this.#node = node
    this.#bindings = bindings
    this.#requiresUnexposedObject = requiresUnexposedObject
    this.#resolved = node?.type === "Identifier" ? bindings.stableValueFor(node) ?? node : node
  }

  get value() {
    return this.#mustKeepOriginal ? this.#node : this.#resolved
  }

  get #mustKeepOriginal() {
    return this.#requiresUnexposedObject ? this.#isExposedObject : false
  }

  get #isExposedObject() {
    return isObjectLiteral(this.#resolved)
      && !ObjectValueConfinement.readOnlyFor(this.#bindings).isSafeAt(this.#node)
  }
}

function isObjectLiteral(node) {
  return node?.type === "ObjectExpression" || node?.type === "ArrayExpression"
    || (node?.type === "Literal" && Boolean(node.regex))
}
