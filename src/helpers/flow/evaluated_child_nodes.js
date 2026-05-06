import { childNodesOf } from "#helpers/syntax/ast"
import { isClassNode } from "#helpers/syntax/classes"
import { isFunction } from "#helpers/syntax/functions"

const RIGHT_IS_EVALUATED = { "&&": Boolean, "||": (value) => !value, "??": (value) => value === null }

export function evaluatedChildNodesOf(node) {
  return new EvaluatedChildNodes(node).values
}

class EvaluatedChildNodes {
  #node

  constructor(node) {
    this.#node = node
  }

  get values() {
    if (this.#isFunction) return []
    if (isClassNode(this.#node)) return this.#classChildren
    if (this.#node.type === "LogicalExpression") return this.#logicalChildren
    if (this.#node.type === "ConditionalExpression") return this.#conditionalChildren
    if (this.#node.type === "Property") return this.#propertyChildren
    return childNodesOf(this.#node)
  }

  get #isFunction() {
    return isFunction(this.#node)
  }

  get #classChildren() {
    return [ this.#node.superClass, ...this.#node.body.body.flatMap(evaluatedPartsOf) ].filter(Boolean)
  }

  get #logicalChildren() {
    return this.#isRightEvaluated ? [ this.#node.left, this.#node.right ] : [ this.#node.left ]
  }

  get #isRightEvaluated() {
    return this.#node.left.type !== "Literal" || RIGHT_IS_EVALUATED[this.#node.operator](this.#node.left.value)
  }

  get #conditionalChildren() {
    return this.#node.test.type === "Literal"
      ? [ this.#node.test, this.#node.test.value ? this.#node.consequent : this.#node.alternate ]
      : [ this.#node.test, this.#node.consequent, this.#node.alternate ]
  }

  get #propertyChildren() {
    return [ this.#node.computed ? this.#node.key : null, this.#node.value ].filter(Boolean)
  }
}

function evaluatedPartsOf(member) {
  if (member.type === "StaticBlock") return member.body

  const key = member.computed ? member.key : null
  return member.type === "PropertyDefinition" && member.static
    ? [ key, member.value ].filter(Boolean)
    : [ key ].filter(Boolean)
}
