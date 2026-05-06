export class StaticCondition {
  #node

  constructor(node) {
    this.#node = node
  }

  get value() {
    let node = this.#node
    let isNegated = false
    while (isNegation(node)) {
      node = node.argument
      isNegated = !isNegated
    }
    const value = primaryValueOf(node)
    return value === null || !isNegated ? value : !value
  }
}

function isNegation(node) {
  return node?.type === "UnaryExpression" && node.operator === "!"
}

function primaryValueOf(node) {
  if (node?.type === "Literal") return Boolean(node.value)
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return Boolean(node.quasis[0].value.cooked)
  return null
}
