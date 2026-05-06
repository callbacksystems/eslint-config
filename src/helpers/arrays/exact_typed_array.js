import { TypedArrayIntrinsicPath } from "#helpers/arrays/typed_array_intrinsic_path"

export class ExactTypedArray {
  #globals
  #node

  constructor(node, globals) {
    this.#node = node
    this.#globals = globals
  }

  get globalName() {
    return this.#constructionName ?? this.#factoryName
  }

  get #constructionName() {
    return this.#node?.type === "NewExpression" ? this.#matchingGlobal(this.#node.callee) : null
  }

  #matchingGlobal(callee) {
    return Array.from(TypedArrayIntrinsicPath.globalNames).find((name) => this.#globals.matches(callee, name)) ?? null
  }

  get #factoryName() {
    return this.#node?.type === "CallExpression"
      ? [ "from", "of" ].flatMap((method) => this.#matchingFactoryGlobal(this.#node.callee, method))[0] ?? null
      : null
  }

  #matchingFactoryGlobal(callee, method) {
    return Array.from(TypedArrayIntrinsicPath.globalNames).filter((name) =>
      this.#globals.matches(callee, name, [ method ])
      && this.#globals.isIntrinsicUnmodifiedAt(callee, TypedArrayIntrinsicPath.intrinsicName, [ method ]))
  }
}
