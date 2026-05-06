import { isDirectString } from "#helpers/syntax/ast"
import { ArrayEvidence } from "#helpers/arrays/array_evidence"
import {
  iteratorPrototypeChainNamesFor,
  iteratorPrototypeIntrinsicNameFor
} from "#helpers/arrays/iterator_intrinsic_path"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"
import { ResourceDisposal } from "#helpers/flow/resource_disposal"
import { sourceOfDestructuringPattern } from "#helpers/syntax/destructuring"
import { UndefinedValueResolver } from "#helpers/flow/undefined_value_resolver"

export class ImplicitCalls {
  #bindings
  #cachedArrays
  #cachedGlobals
  #cachedUndefinedValues
  #sourceCode

  constructor(sourceCode, bindings) {
    this.#sourceCode = sourceCode
    this.#bindings = bindings
  }

  areUnknownAt(node) {
    if (new ResourceDisposal(node, { undefinedValues: this.#undefinedValues }).canCallUserCode) return true
    if (isObjectSpread(node)) {
      return !new ExactObjectCopySource(node.argument, {
        bindings: this.#bindings,
        undefinedValues: this.#undefinedValues
      }).isPresent
    }

    const iterable = iterableOf(node)
    if (!iterable) return node.type === "ArrayPattern"
    if (node.type === "ForOfStatement" && node.await) return true
    return !new ExactSynchronousIteration(iterable, {
      arrays: this.#arrays,
      bindings: this.#bindings,
      globals: this.#globals,
      operation: node
    }).isPure
  }

  get #undefinedValues() {
    return this.#cachedUndefinedValues ??= new UndefinedValueResolver(this.#bindings)
  }

  get #arrays() {
    return this.#cachedArrays ??= new ArrayEvidence(this.#sourceCode)
  }

  get #globals() {
    return this.#cachedGlobals ??= new GlobalValueIdentity(this.#bindings)
  }
}

function isObjectSpread(node) {
  return node.type === "SpreadElement" && node.parent.type === "ObjectExpression"
}

class ExactObjectCopySource {
  #bindings
  #node
  #undefinedValues

  constructor(node, { bindings, undefinedValues }) {
    this.#bindings = bindings
    this.#node = node
    this.#undefinedValues = undefinedValues
  }

  get isPresent() {
    return this.#isDefinitelyUndefined || this.#isSafeUnaryValue
      || new DirectObjectCopySource(this.#value).isPresent
  }

  get #isDefinitelyUndefined() {
    return this.#node.type === "Identifier" && this.#undefinedValues.isDefinitelyUndefined(this.#node)
  }

  get #isSafeUnaryValue() {
    return this.#node.type === "UnaryExpression" && [ "!", "typeof", "void" ].includes(this.#node.operator)
  }

  get #value() {
    return this.#node.type === "Identifier" ? this.#bindings.stableValueFor(this.#node) : this.#node
  }
}

class DirectObjectCopySource {
  #node

  constructor(node) {
    this.#node = node
  }

  get isPresent() {
    switch (this.#node?.type) {
      case "ArrayExpression":
      case "Literal": return true
      case "ObjectExpression": return this.#node.properties.every(({ kind }) => kind !== "get")
      case "TemplateLiteral": return this.#node.expressions.length === 0
      default: return false
    }
  }
}

function iterableOf(node) {
  if (node.type === "ForOfStatement") return node.right
  if (node.type === "ArrayPattern") return sourceOfDestructuringPattern(node)
  if (node.type === "YieldExpression" && node.delegate) return node.argument
  if (node.type === "SpreadElement" && node.parent.type !== "ObjectExpression") return node.argument
  return null
}

class ExactSynchronousIteration {
  #arrays
  #bindings
  #globals
  #iterable
  #operation

  constructor(iterable, { arrays, bindings, globals, operation }) {
    this.#iterable = iterable
    this.#arrays = arrays
    this.#bindings = bindings
    this.#globals = globals
    this.#operation = operation
  }

  get isPure() {
    return this.#isExactArray || this.#isExactString
  }

  get #isExactArray() {
    return this.#arrays.isEvident(this.#iterable) && this.#hasUnmodifiedOwnArrayIterator
      && this.#globals.isIntrinsicUnmodifiedAt(this.#operation, "Array", [ "prototype", Symbol.iterator ])
      && this.#hasUnmodifiedIteratorNext("Array")
  }

  get #hasUnmodifiedOwnArrayIterator() {
    return this.#iterable.type !== "Identifier"
      || this.#arrays.isOwnMemberUnmodifiedAt(this.#iterable, Symbol.iterator, this.#operation)
  }

  #hasUnmodifiedIteratorNext(globalName) {
    return this.#globals.isIntrinsicUnmodifiedAt(this.#operation,
      iteratorPrototypeIntrinsicNameFor(globalName), [ "next" ])
    && iteratorPrototypeChainNamesFor(globalName).every((prototypeName) =>
      this.#globals.isAbsentAndUnmodifiedAt(this.#operation, prototypeName, [ "return" ]))
  }

  get #isExactString() {
    return isDirectString(this.#value)
      && this.#globals.isIntrinsicUnmodifiedAt(this.#operation, "String", [ "prototype", Symbol.iterator ])
      && this.#hasUnmodifiedIteratorNext("String")
  }

  get #value() {
    return this.#iterable.type === "Identifier"
      ? this.#bindings.stableValueFor(this.#iterable)
      : this.#iterable
  }
}
