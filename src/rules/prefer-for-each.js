// `for...of` doing pure side-effect iteration reads better as `.forEach()`:
// declarative, no loop scaffolding. Skipped when the body needs `break`,
// `continue`, `return`, `await`, or `yield` (which `forEach` cannot express),
// for `for await...of`, and for string literals (which have no `.forEach`).
// Conservative on purpose: control flow inside nested loops still skips the
// outer loop, so it never suggests an impossible conversion.

import { countMatching, isFunction, operandText } from "#helpers/ast"
import { reportProblem } from "#helpers/report"

const ESCAPE_TYPES = new Set([
  "AwaitExpression",
  "BreakStatement",
  "ContinueStatement",
  "ReturnStatement",
  "YieldExpression"
])
const LOOSE_RECEIVERS = new Set([
  "AssignmentExpression", "AwaitExpression", "BinaryExpression", "ConditionalExpression",
  "LogicalExpression", "SequenceExpression", "UnaryExpression", "YieldExpression"
])
const EXPRESSION_BODY_PARENS = new Set([ "ObjectExpression", "SequenceExpression" ])

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Prefer `.forEach()` over `for...of` for pure array iteration" },
    schema: [],
    messages: {
      preferForEach: "Prefer `.forEach()` over `for...of` for pure iteration (no break/continue/return/await)."
    }
  },
  create(context) {
    return { ForOfStatement: (node) => reportProblem(context, new Loop(node, context.sourceCode)) }
  }
}

class Loop {
  #node
  #sourceCode

  constructor(node, sourceCode) {
    this.#node = node
    this.#sourceCode = sourceCode
  }

  get problem() {
    return this.#isConvertible ? { node: this.#node, messageId: "preferForEach", fix: this.#fix } : null
  }

  get #isConvertible() {
    return this.#isPlain && !this.#hasOwnEscape
  }

  get #isPlain() {
    return !this.#node.await && !isStringIterable(this.#node.right)
  }

  // An escape inside the body counts only when it is the loop's own: an escape in
  // a nested function belongs to that function, so it is ignored.
  get #hasOwnEscape() {
    const { body } = this.#node
    return countMatching(body, (node) => isOwnEscape(node, body)) > 0
  }

  // Only a fresh `const`/`let` binding maps cleanly to a `forEach` parameter.
  // Looping over an existing variable or member would change which binding
  // survives the loop, so that case is reported but left for a human to rewrite.
  get #fix() {
    return this.#hasFreshBinding ? (fixer) => fixer.replaceText(this.#node, this.#forEachText) : null
  }

  get #hasFreshBinding() {
    return this.#node.left.type === "VariableDeclaration"
  }

  get #forEachText() {
    return `${this.#receiverText}.forEach((${this.#paramText}) => ${this.#bodyText})`
  }

  get #receiverText() {
    return operandText(this.#sourceCode, this.#node.right, LOOSE_RECEIVERS)
  }

  get #paramText() {
    return this.#sourceCode.getText(this.#node.left.declarations[0].id)
  }

  get #bodyText() {
    const source = this.#sourceCode
    const { body } = this.#node
    if (body.type === "BlockStatement") return source.getText(body)
    if (body.type === "ExpressionStatement") return operandText(source, body.expression, EXPRESSION_BODY_PARENS)
    return `{ ${source.getText(body)} }`
  }
}

function isStringIterable(node) {
  return node.type === "TemplateLiteral" || (node.type === "Literal" && typeof node.value === "string")
}

function isOwnEscape(candidate, boundary) {
  return ESCAPE_TYPES.has(candidate.type) && !crossesFunction(candidate, boundary)
}

function crossesFunction(candidate, boundary) {
  if (candidate === boundary) return false

  for (let current = candidate.parent; current && current !== boundary; current = current.parent) {
    if (isFunction(current)) return true
  }
  return false
}
