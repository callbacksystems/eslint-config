// `for...of` doing pure side-effect iteration reads better as `.forEach()`: declarative, no loop scaffolding. Skipped
// when the body needs `break`, `continue`, `return`, `await`, or `yield` (which `forEach` cannot express), for `for
// await...of`, and for string literals (which have no `.forEach`). Conservative on purpose: control flow inside nested
// loops still skips the outer loop, so it never suggests an impossible conversion.
//
// The autofix additionally needs the iterable to be demonstrably an array. Every iterable works with `for...of`, but
// `forEach` is not universal: a generator has none, and `Map.prototype.forEach` yields `(value, key)` rather than the
// `[key, value]` entry the loop destructures. Anything the file does not show to be an array is reported and left for a
// human.

import { countMatching } from "#helpers/ast"
import { isFunction } from "#helpers/functions"
import { operandText } from "#helpers/source"
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
// `map`/`filter` on a non-array receiver (a d3 selection, an observable) is the known blind spot of this list.
const ARRAY_METHODS = new Set([
  "concat", "filter", "flat", "flatMap", "map", "slice", "split", "toReversed", "toSorted", "toSpliced"
])
const ARRAY_STATICS = { Array: new Set([ "from", "of" ]), Object: new Set([ "entries", "keys", "values" ]) }

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

  // An escape in a nested function belongs to that function.
  get #hasOwnEscape() {
    const { body } = this.#node
    return countMatching(body, (node) => new Candidate(node, body).isOwnEscape) > 0
  }

  // Looping over an existing variable or member would change which binding survives the loop.
  get #fix() {
    return this.#isFixable ? (fixer) => fixer.replaceText(this.#node, this.#forEachText) : null
  }

  get #isFixable() {
    return this.#hasFreshBinding && this.#hasIterableWithForEach
  }

  get #hasFreshBinding() {
    return this.#node.left.type === "VariableDeclaration"
  }

  get #hasIterableWithForEach() {
    return this.#isEvidentArray || (!this.#isCallReceiver && !this.#isDestructuredElement)
  }

  get #isEvidentArray() {
    return new ArrayValue(this.#node.right, this.#sourceCode).isEvident
  }

  get #isCallReceiver() {
    return this.#node.right.type === "CallExpression"
  }

  get #isDestructuredElement() {
    return this.#node.left.declarations[0].id.type !== "Identifier"
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

class Candidate {
  #node
  #boundary

  constructor(node, boundary) {
    this.#node = node
    this.#boundary = boundary
  }

  get isOwnEscape() {
    return ESCAPE_TYPES.has(this.#node.type) && !this.#crossesFunction
  }

  get #crossesFunction() {
    if (this.#node === this.#boundary) return false

    for (let current = this.#node.parent; current && current !== this.#boundary; current = current.parent) {
      if (isFunction(current)) return true
    }
    return false
  }
}

// A binding is followed one level only, which covers `const items = [...]` with no risk of chasing a cycle.
class ArrayValue {
  #node
  #sourceCode
  #cachedBinding

  constructor(node, sourceCode) {
    this.#node = node
    this.#sourceCode = sourceCode
  }

  get isEvident() {
    return isDirectArray(this.#node) || (this.#node.type === "Identifier" && this.#isBoundToArray)
  }

  get #isBoundToArray() {
    return Boolean(this.#binding) && this.#binding.defs.length === 1 && isConstArrayDefinition(this.#binding.defs[0])
  }

  get #binding() {
    return this.#cachedBinding ??= this.#sourceCode.getScope(this.#node).references
      .find((reference) => reference.identifier === this.#node)?.resolved ?? null
  }
}

function isDirectArray(node) {
  return node.type === "ArrayExpression" || (node.type === "CallExpression" && isArrayCall(node))
}

function isArrayCall(node) {
  const { callee } = node
  if (callee.type !== "MemberExpression" || callee.computed) return false
  if (ARRAY_METHODS.has(callee.property.name)) return true

  return callee.object.type === "Identifier" && Boolean(ARRAY_STATICS[callee.object.name]?.has(callee.property.name))
}

function isConstArrayDefinition(definition) {
  return definition.type === "Variable"
    && definition.parent.kind === "const"
    && Boolean(definition.node.init)
    && isDirectArray(definition.node.init)
}
