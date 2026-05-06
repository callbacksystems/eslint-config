// `Array.from(x).map(fn)` and `[ ...x ].map(fn)` build an array only to walk it again, when `Array.from(x, fn)` takes
// the mapping function and does both in one pass. Skipped when a `.flat()` with the default depth follows (that is
// `flatMap` territory), when `Array` is shadowed, and when the callback is not an arrow or function expression with at
// most two parameters and no rest, since `Array.from` hands its mapper the element and index but not the array. A
// `thisArg` goes through, since `Array.from` takes one too. `no-manual-accumulation` covers the loop form.

import { commentsIn } from "#helpers/source"
import { isFunctionLike } from "#helpers/functions"
import { reportProblem } from "#helpers/report"

const MAP_ARGUMENT_COUNTS = new Set([ 1, 2 ])

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Prefer `Array.from(x, fn)` over mapping the array `Array.from(x)` or `[ ...x ]` builds" },
    schema: [],
    messages: {
      preferArrayFromMapping: "Pass the mapping function to `Array.from` instead of mapping the array it builds."
    }
  },
  create(context) {
    return { CallExpression: (node) => reportProblem(context, new MapCall(node, context.sourceCode)) }
  }
}

class MapCall {
  #node
  #sourceCode

  constructor(node, sourceCode) {
    this.#node = node
    this.#sourceCode = sourceCode
  }

  get problem() {
    return this.#isOffense ? { node: this.#node, messageId: "preferArrayFromMapping", fix: this.#fix } : null
  }

  get #isOffense() {
    return this.#isMapCall && this.#hasSupportedCallback && this.#builtArray.isRewritable && !this.#isFlattened
  }

  get #isMapCall() {
    return isPlainMethodCall(this.#node, "map") && MAP_ARGUMENT_COUNTS.has(this.#node.arguments.length)
  }

  get #hasSupportedCallback() {
    const [ callback ] = this.#node.arguments
    return isFunctionLike(callback) && callback.params.length <= 2 && callback.params.every(isNotRest)
  }

  get #builtArray() {
    return new BuiltArray(this.#node.callee.object, this.#sourceCode)
  }

  get #isFlattened() {
    const { parent } = this.#node
    return parent.type === "MemberExpression" && parent.object === this.#node && isDefaultFlatCall(parent.parent)
  }

  get #fix() {
    return (fixer) => this.#splices.map((splice) => fixer.replaceTextRange(splice.range, splice.replacement))
  }

  get #splices() {
    return [ ...this.#builtArray.openingSplices, this.#joiningSplice ]
  }

  get #joiningSplice() {
    return new Splice(this.#sourceCode, this.#rangeBetweenIterableAndCallback, ", ")
  }

  get #rangeBetweenIterableAndCallback() {
    return [ this.#builtArray.iterableEnd, this.#sourceCode.getTokenAfter(this.#argumentsOpener).range[0] ]
  }

  get #argumentsOpener() {
    return this.#sourceCode.getTokenAfter(this.#node.callee)
  }
}

function isPlainMethodCall(node, method) {
  const { callee } = node
  return !node.optional
    && callee.type === "MemberExpression"
    && !callee.computed
    && !callee.optional
    && callee.property.name === method
}

function isNotRest(parameter) {
  return parameter.type !== "RestElement"
}

// The receiver of `.map`, `Array.from(x)` or `[ ...x ]`.
class BuiltArray {
  #node
  #sourceCode

  constructor(node, sourceCode) {
    this.#node = node
    this.#sourceCode = sourceCode
  }

  get isRewritable() {
    return (this.#isArrayFrom || this.#isSpread) && isGlobalArrayAt(this.#sourceCode, this.#node)
  }

  get openingSplices() {
    return this.#isSpread ? [ new Splice(this.#sourceCode, this.#spreadOpeningRange, "Array.from(") ] : []
  }

  get iterableEnd() {
    return this.#sourceCode.getTokenBefore(this.#closer, isNotComma).range[1]
  }

  get #isArrayFrom() {
    return this.#node.type === "CallExpression"
      && isPlainMethodCall(this.#node, "from")
      && isIdentifierNamed(this.#node.callee.object, "Array")
      && this.#node.arguments.length === 1
  }

  get #isSpread() {
    return this.#node.type === "ArrayExpression"
      && this.#node.elements.length === 1
      && this.#node.elements[0]?.type === "SpreadElement"
  }

  get #spreadOpeningRange() {
    return [ this.#node.range[0], this.#sourceCode.getTokenAfter(this.#dots).range[0] ]
  }

  get #dots() {
    return this.#sourceCode.getFirstToken(this.#node.elements[0])
  }

  get #closer() {
    return this.#sourceCode.getLastToken(this.#node)
  }
}

function isGlobalArrayAt(sourceCode, node) {
  return Array.from(scopesAbove(sourceCode.getScope(node))).every((scope) => !declaresArray(scope))
}

function* scopesAbove(scope) {
  for (let current = scope; current; current = current.upper) yield current
}

function declaresArray(scope) {
  return (scope.set.get("Array")?.defs.length ?? 0) > 0
}

// A comment caught in the range moves after the joining text, with a line break after a line comment so the code that
// follows stays code.
class Splice {
  #sourceCode
  #text

  constructor(sourceCode, range, text) {
    this.#sourceCode = sourceCode
    this.range = range
    this.#text = text
  }

  get replacement() {
    return this.#comments.length > 0 ? `${this.#text.trimEnd()} ${this.#commentsText}${this.#separator}` : this.#text
  }

  get #comments() {
    return commentsIn(this.#sourceCode, this.range)
  }

  get #commentsText() {
    return this.#comments.map((comment) => this.#sourceCode.getText(comment)).join(" ")
  }

  get #separator() {
    return this.#comments.some((comment) => comment.type === "Line") ? `\n${this.#indent}` : " "
  }

  get #indent() {
    const { line } = this.#sourceCode.getLocFromIndex(this.range[1])
    return /^[ \t]*/u.exec(this.#sourceCode.lines[line - 1])[0]
  }
}

function isNotComma(token) {
  return token.value !== ","
}

function isIdentifierNamed(node, name) {
  return node.type === "Identifier" && node.name === name
}

function isDefaultFlatCall(node) {
  return node.type === "CallExpression"
    && isPlainMethodCall(node, "flat")
    && (node.arguments.length === 0 || isLiteralOne(node.arguments[0]))
}

function isLiteralOne(node) {
  return node.type === "Literal" && node.raw === "1"
}
