export class BindingDefinition {
  #definition

  constructor(definition) {
    this.#definition = definition
  }

  get isImmutable() {
    return this.#isImport || this.#isImmutableVariable
      || this.#isClassExpressionName || this.#isFunctionExpressionName
  }

  get isConstant() {
    return this.#isConstant
  }

  get isSimpleConstant() {
    return this.#isConstant && this.#definition.node.id.type === "Identifier"
  }

  get #isImport() {
    return this.#definition?.type === "ImportBinding"
  }

  get #isImmutableVariable() {
    return this.#definition?.type === "Variable"
      && [ "await using", "const", "using" ].includes(this.#definition.parent.kind)
  }

  get #isClassExpressionName() {
    return this.#definition?.type === "ClassName" && this.#definition.node.type === "ClassExpression"
  }

  get #isFunctionExpressionName() {
    return this.#definition?.type === "FunctionName" && this.#definition.node.type === "FunctionExpression"
  }

  get #isConstant() {
    return this.#definition?.type === "Variable" && this.#definition.parent.kind === "const"
  }
}
