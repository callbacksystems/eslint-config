export class ObjectSpreadEvaluation {
  #source

  constructor(source) {
    this.#source = source
  }

  get isSideEffectFree() {
    return this.#source?.type === "ObjectExpression"
      ? !this.#hasOwnGetter
      : this.#isLiteralCollection || this.#isPrimitive
  }

  get #hasOwnGetter() {
    return this.#source.properties.some((property) =>
      property.type === "Property" && property.kind === "get")
  }

  get #isLiteralCollection() {
    return this.#source?.type === "ArrayExpression"
      || (this.#source?.type === "Literal" && Boolean(this.#source.regex))
  }

  get #isPrimitive() {
    return this.#source?.type === "Literal" || this.#source?.type === "TemplateLiteral"
      || this.#source?.type === "UnaryExpression"
  }
}
