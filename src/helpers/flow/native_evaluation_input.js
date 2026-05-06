import { stableExpressionFor } from "#helpers/flow/stable_expression"
import { UndefinedValueResolver } from "#helpers/flow/undefined_value_resolver"
import { isDirectString, isStaticTemplateLiteral } from "#helpers/syntax/ast"

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
    return stableExpressionFor(this.#node, this.#bindings)
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
    return this.#isLiteral || isStaticTemplateLiteral(this.#node) || this.#isPrimitiveUnary
  }

  get isNullish() {
    return (this.#node?.type === "Literal" && this.#node.value === null)
      || (this.#node?.type === "UnaryExpression" && this.#node.operator === "void")
  }

  get isString() {
    return isDirectString(this.#node)
  }

  get #isLiteral() {
    return this.#node?.type === "Literal" && !this.#node.regex
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
