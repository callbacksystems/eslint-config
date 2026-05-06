import {
  iteratorPrototypeChainNamesFor,
  iteratorPrototypeIntrinsicNameFor
} from "#helpers/arrays/iterator_intrinsic_path"
import { isDirectString } from "#helpers/syntax/ast"

export class ExactIterationSource {
  #globals
  #node
  #operation

  static isSafeIn(node, context) {
    return new ExactIterationSource(node, { globals: context.globals, operation: context.node }).isSafe
  }

  constructor(node, { operation, globals }) {
    this.#node = node
    this.#operation = operation
    this.#globals = globals
  }

  get isSafe() {
    return this.#node.type === "ArrayExpression" ? this.#isSafeArray : this.#isSafeString
  }

  get #isSafeArray() {
    return this.#node.elements.every((element) => element && element.type !== "SpreadElement")
      && this.#hasNativeIteration("Array")
  }

  #hasNativeIteration(globalName) {
    return this.#globals.isIntrinsicUnmodifiedAt(this.#operation, globalName, [ "prototype", Symbol.iterator ])
      && this.#globals.isIntrinsicUnmodifiedAt(
        this.#operation, iteratorPrototypeIntrinsicNameFor(globalName), [ "next" ])
      && iteratorPrototypeChainNamesFor(globalName).every((prototypeName) =>
        this.#globals.isAbsentAndUnmodifiedAt(this.#operation, prototypeName, [ "return" ]))
  }

  get #isSafeString() {
    return isDirectString(this.#node) && this.#hasNativeIteration("String")
  }
}
