import { soleStatementOf } from "#helpers/syntax/functions"
import { isStaticTemplateLiteral, pushAll } from "#helpers/syntax/ast"

const LITERAL_TYPES = new Set([ "Literal", "TemplateLiteral", "ObjectExpression", "ArrayExpression" ])
const PRIMITIVE_TYPES = new Set([ "Literal", "TemplateLiteral" ])
const NUMERIC_UNARY_OPERATORS = new Set([ "-", "+", "~" ])

export function returnsFixedLiteral(body) {
  const statement = soleStatementOf(body)
  return statement?.type === "ReturnStatement" && new Literal(statement.argument).isFixed
}

export function isFixedPrimitive(node) {
  return new Literal(node, PRIMITIVE_TYPES).isFixed
}

export function staticStringValueOf(node) {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value
  return node?.type === "TemplateLiteral" && node.expressions.length === 0 ? node.quasis[0].value.cooked : null
}

class Literal {
  #pending
  #isFixed = true

  constructor(node, types = LITERAL_TYPES) {
    this.#pending = [ { node, types } ]
  }

  get isFixed() {
    while (this.#isFixed && this.#pending.length > 0) this.#evaluateNext()
    return this.#isFixed
  }

  #evaluateNext() {
    const part = new LiteralPart(this.#pending.pop())
    this.#isFixed = part.isFixed
    if (this.#isFixed) pushAll(this.#pending, part.children)
  }
}

class LiteralPart {
  #node
  #types

  constructor({ node, types }) {
    this.#node = node
    this.#types = types
  }

  get isFixed() {
    return this.#isAllowedLiteral || this.#isSigned
  }

  get children() {
    switch (this.#node?.type) {
      case "ObjectExpression": return this.#propertyChildren
      case "ArrayExpression": return this.#childrenOf(this.#node.elements)
      case "TemplateLiteral": return this.#childrenOf(this.#node.expressions)
      default: return []
    }
  }

  get #isAllowedLiteral() {
    return this.#types.has(this.#node?.type) && !this.#node.regex
  }

  get #isSigned() {
    return this.#node?.type === "UnaryExpression" && new FixedNumeric(this.#node).isPresent
  }

  get #propertyChildren() {
    return this.#node.properties.flatMap((property) => this.#childrenOfProperty(property))
  }

  #childrenOfProperty(property) {
    if (property.type !== "Property") return this.#childrenOf([ property ])

    const value = { node: property.value, types: this.#types }
    return property.computed ? [ { node: property.key, types: PRIMITIVE_TYPES }, value ] : [ value ]
  }

  #childrenOf(nodes) {
    return nodes.filter((node) => node !== null).map((node) => ({ node, types: this.#types }))
  }
}

// Numeric unary operators are fixed only when their complete coercion chain is both primitive and non-throwing.
// In particular, unary `+` rejects BigInt at runtime, including when another operator hides the BigInt leaf.
class FixedNumeric {
  #node

  constructor(node) {
    this.#node = node
  }

  get isPresent() {
    const { leaf, operators } = this.#chain
    const kind = new PrimitiveKind(leaf).value
    return Boolean(kind) && (kind !== "bigint" || !operators.includes("+"))
  }

  get #chain() {
    const operators = []
    let leaf = this.#node
    while (leaf?.type === "UnaryExpression" && NUMERIC_UNARY_OPERATORS.has(leaf.operator)) {
      operators.push(leaf.operator)
      leaf = leaf.argument
    }
    return { leaf, operators }
  }
}

class PrimitiveKind {
  #node

  constructor(node) {
    this.#node = node
  }

  get value() {
    if (this.#isLiteral) return this.#isBigInt ? "bigint" : "other"
    return isStaticTemplateLiteral(this.#node) ? "other" : null
  }

  get #isLiteral() {
    return this.#node?.type === "Literal" && !this.#node.regex
  }

  get #isBigInt() {
    return typeof this.#node.value === "bigint" || typeof this.#node.bigint === "string"
  }
}
