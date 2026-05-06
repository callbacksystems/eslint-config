// `Array.from(x).map(fn)` and `[ ...x ].map(fn)` build an array only to walk it again, when `Array.from(x, fn)` takes
// the mapping function and does both in one pass. Skipped when a `.flat()` with the default depth follows (that is
// `flatMap` territory), when `Array` is shadowed or reassigned, and when the callback is not an arrow or function
// expression that cannot observe a third argument, since `Array.from` hands its mapper the element and index but not
// the array. A `thisArg` goes through, since `Array.from` takes one too. `no-manual-accumulation` covers the loop form.

import { calleeMemberName } from "#helpers/syntax/classes"
import { hasToolDirectiveIn } from "#helpers/source/comment_directives"
import { hasDirectEvalIn } from "#helpers/scope/dynamic_scope"
import { hasOwnArgumentsAccess, isFunctionLike } from "#helpers/syntax/functions"
import { isReassignment } from "#helpers/scope/references"
import { reportProblem } from "#helpers/eslint/report"
import { commentsIn } from "#helpers/source/source"

const MAP_ARGUMENT_COUNTS = new Set([ 1, 2 ])
const GLOBAL_ARRAYS = new WeakMap()

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
  #cachedBuiltArray

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
    return isFunctionLike(callback)
      && callback.params.length <= 2
      && callback.params.every(isNotRest)
      && !this.#canObserveThirdArgument(callback)
  }

  #canObserveThirdArgument(callback) {
    return callback.type === "FunctionExpression"
      && (hasOwnArgumentsAccess(callback, this.#sourceCode) || hasDirectEvalIn(this.#sourceCode, callback.body))
  }

  get #builtArray() {
    return this.#cachedBuiltArray ??= new BuiltArray(this.#node.callee.object, this.#sourceCode)
  }

  get #isFlattened() {
    const { parent } = this.#node
    return parent.type === "MemberExpression" && parent.object === this.#node && isDefaultFlatCall(parent.parent)
  }

  get #fix() {
    return this.#isSafelyMappable
      ? (fixer) => this.#splices.map((splice) => fixer.replaceTextRange(splice.range, splice.replacement))
      : null
  }

  // Building must finish before mapping in the original. Combining passes is equivalent only when the iterable is a
  // fresh ordinary array that the callback cannot reach, and an arrow cannot observe the callback argument count.
  get #isSafelyMappable() {
    return this.#node.arguments.length === 1
      && this.#node.arguments[0].type === "ArrowFunctionExpression"
      && this.#builtArray.isFreshDenseArrayCopy
      && !this.#hasToolDirective
  }

  get #hasToolDirective() {
    return hasToolDirectiveIn({ sourceCode: this.#sourceCode, node: this.#node })
  }

  get #splices() {
    return [ this.#joiningSplice ]
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
    && !callee.optional
    && calleeMemberName(callee) === method
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

  get isFreshDenseArrayCopy() {
    return this.#isArrayFrom && this.#hasFreshDenseIterable
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

  get #hasFreshDenseIterable() {
    const [ iterable ] = this.#node.arguments
    return iterable.type === "ArrayExpression" && iterable.elements.every(Boolean)
  }

  get #closer() {
    return this.#sourceCode.getLastToken(this.#node)
  }
}

function isGlobalArrayAt(sourceCode, node) {
  if (!GLOBAL_ARRAYS.has(sourceCode)) {
    GLOBAL_ARRAYS.set(sourceCode, new GlobalArray(sourceCode))
  }
  return GLOBAL_ARRAYS.get(sourceCode).isVisibleAt(node)
}

class GlobalArray {
  #sourceCode
  #visibilityByScope = new WeakMap()
  #cachedIsWritten

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  isVisibleAt(node) {
    return new ArrayScopeVisibility(this.#sourceCode.getScope(node), this.#visibilityByScope).isVisible
      && !this.#isWritten
  }

  get #isWritten() {
    return this.#cachedIsWritten ??= this.#hasWrite
  }

  get #hasWrite() {
    const { globalScope } = this.#sourceCode.scopeManager
    const resolved = globalScope.set.get("Array")?.references ?? []
    return resolved.concat(globalScope.through.filter(isArrayReference)).some(isReassignment)
  }
}

class ArrayScopeVisibility {
  #current
  #values
  #path = []

  constructor(scope, values) {
    this.#current = scope
    this.#values = values
  }

  get isVisible() {
    while (this.#canAdvance) this.#advance()
    return this.#remember(this.#endingValue)
  }

  get #canAdvance() {
    return Boolean(this.#current) && !this.#isCached && !isArrayDeclared(this.#current)
  }

  get #isCached() {
    return Boolean(this.#current) && this.#values.has(this.#current)
  }

  #advance() {
    this.#path.push(this.#current)
    this.#current = this.#current.upper
  }

  #remember(value) {
    this.#path.forEach((scope) => this.#values.set(scope, value))
    if (this.#current && !this.#isCached) this.#values.set(this.#current, value)
    return value
  }

  get #endingValue() {
    if (this.#current) {
      return this.#isCached ? this.#values.get(this.#current) : false
    } else {
      return true
    }
  }
}

function isArrayDeclared(scope) {
  return (scope.set.get("Array")?.defs.length ?? 0) > 0
}

function isArrayReference(reference) {
  return reference.identifier.name === "Array"
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
    && (node.arguments.length === 0 || isDefaultFlatDepth(node.arguments[0]))
}

function isDefaultFlatDepth(node) {
  return node.type === "Literal" && typeof node.value === "number" && Math.trunc(node.value) === 1
}

// A comment caught in the range moves after the joining text, with a line break after a line comment so the code that
// follows stays code.
class Splice {
  #sourceCode
  #text
  #cachedComments

  constructor(sourceCode, range, text) {
    this.#sourceCode = sourceCode
    this.range = range
    this.#text = text
  }

  get replacement() {
    return this.#comments.length > 0 ? `${this.#text.trimEnd()} ${this.#commentsText}${this.#separator}` : this.#text
  }

  get #comments() {
    return this.#cachedComments ??= commentsIn(this.#sourceCode, this.range)
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
