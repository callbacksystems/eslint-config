import { UndefinedValueResolver } from "#helpers/flow/undefined_value_resolver"

const UNDEFINED_VALUES_BY_SOURCE = new WeakMap()

export class NativeEvaluationInput {
  #bindings
  #node

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
  }

  get isSafe() {
    const direct = new DirectPrimitive(this.#value)
    return direct.isPresent || this.isUndefined
  }

  get isUndefined() {
    return this.#isVoid || this.#isUndefinedIdentifier
  }

  get isNullish() {
    return new DirectPrimitive(this.#value).isNullish || this.isUndefined
  }

  get isString() {
    return new DirectPrimitive(this.#value).isString
  }

  get #value() {
    return this.#node?.type === "Identifier"
      ? this.#bindings.stableValueFor(this.#node) ?? this.#node
      : this.#node
  }

  get #isVoid() {
    return this.#node?.type === "UnaryExpression" && this.#node.operator === "void"
  }

  get #isUndefinedIdentifier() {
    return this.#node?.type === "Identifier"
      && undefinedValuesFor(this.#bindings).isDefinitelyUndefined(this.#node)
  }
}

class DirectPrimitive {
  #node

  constructor(node) {
    this.#node = node
  }

  get isPresent() {
    return this.#isLiteral || this.#isConstantTemplate || this.#isPrimitiveUnary
  }

  get isNullish() {
    return (this.#node?.type === "Literal" && this.#node.value === null)
      || (this.#node?.type === "UnaryExpression" && this.#node.operator === "void")
  }

  get isString() {
    return (this.#node?.type === "Literal" && typeof this.#node.value === "string") || this.#isConstantTemplate
  }

  get #isLiteral() {
    return this.#node?.type === "Literal" && !this.#node.regex
  }

  get #isConstantTemplate() {
    return this.#node?.type === "TemplateLiteral" && this.#node.expressions.length === 0
  }

  get #isPrimitiveUnary() {
    return this.#node?.type === "UnaryExpression" && [ "!", "typeof", "void" ].includes(this.#node.operator)
  }
}

function undefinedValuesFor(bindings) {
  const { sourceCode } = bindings
  if (!UNDEFINED_VALUES_BY_SOURCE.has(sourceCode)) {
    UNDEFINED_VALUES_BY_SOURCE.set(sourceCode, new UndefinedValueResolver(bindings))
  }
  return UNDEFINED_VALUES_BY_SOURCE.get(sourceCode)
}
