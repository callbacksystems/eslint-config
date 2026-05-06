// Shared so the rules that would otherwise advise a getter or a module-level function defer to `prefer-constant`, and
// so that what counts as a fixed value is answered once, at the reach each caller asks for.

import { soleStatementOf } from "#helpers/functions"

const LITERAL_TYPES = new Set([ "Literal", "TemplateLiteral", "ObjectExpression", "ArrayExpression" ])
const PRIMITIVE_TYPES = new Set([ "Literal", "TemplateLiteral" ])
const SIGN_OPERATORS = new Set([ "-", "+", "~" ])

export function returnsFixedLiteral(body) {
  const statement = soleStatementOf(body)
  return statement?.type === "ReturnStatement" && new Literal(statement.argument).isFixed
}

export function isFixedPrimitive(node) {
  return new Literal(node, PRIMITIVE_TYPES).isFixed
}

class Literal {
  #node
  #types

  constructor(node, types = LITERAL_TYPES) {
    this.#node = node
    this.#types = types
  }

  get isFixed() {
    return this.#types.has(this.#node?.type) ? this.#holdsOnlyLiterals : this.#isSigned
  }

  get #holdsOnlyLiterals() {
    return this.#values.every((value) => new Literal(value, this.#types).isFixed)
  }

  // A computed key or a spread reaches outside the literal, so the value is composed rather than stated.
  get #values() {
    if (this.#node.type === "ObjectExpression") return this.#propertyValues
    if (this.#node.type === "ArrayExpression") return this.#node.elements

    return this.#node.type === "TemplateLiteral" ? this.#node.expressions : []
  }

  get #propertyValues() {
    return this.#node.properties.map((property) =>
      (property.type === "Property" && !property.computed ? property.value : property))
  }

  get #isSigned() {
    return this.#node?.type === "UnaryExpression"
      && SIGN_OPERATORS.has(this.#node.operator)
      && new Literal(this.#node.argument, this.#types).isFixed
  }
}
