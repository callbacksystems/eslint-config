import {
  iteratorPrototypeChainNamesFor,
  iteratorPrototypeIntrinsicNameFor
} from "#helpers/arrays/iterator_intrinsic_path"

export class ExactIterationSource {
  #globals
  #node
  #operation

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

function isDirectString(node) {
  return (node.type === "Literal" && typeof node.value === "string")
    || (node.type === "TemplateLiteral" && node.expressions.length === 0)
}
