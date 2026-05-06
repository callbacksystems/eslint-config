const GLOBAL_NAMES = new Set([
  "BigInt64Array", "BigUint64Array", "Float16Array", "Float32Array", "Float64Array", "Int8Array", "Int16Array",
  "Int32Array", "Uint8Array", "Uint8ClampedArray", "Uint16Array", "Uint32Array"
])

const INTRINSIC_NAME = "%TypedArray%"

export class TypedArrayIntrinsicPath {
  #argumentPath
  #calleePath

  static get globalNames() {
    return GLOBAL_NAMES
  }

  static get intrinsicName() {
    return INTRINSIC_NAME
  }

  static isPrototypeLookup(path) {
    return path?.equals("Object", [ "getPrototypeOf" ]) === true
      || path?.equals("Reflect", [ "getPrototypeOf" ]) === true
  }

  constructor(calleePath, argumentPath) {
    this.#calleePath = calleePath
    this.#argumentPath = argumentPath
  }

  get value() {
    return this.#isPrototypeLookup && this.#typedArrayPath
      ? { globalName: INTRINSIC_NAME, members: this.#typedArrayPath.members }
      : null
  }

  get #isPrototypeLookup() {
    return TypedArrayIntrinsicPath.isPrototypeLookup(this.#calleePath)
  }

  get #typedArrayPath() {
    return GLOBAL_NAMES.has(this.#argumentPath?.globalName) && isTypedArrayBasePath(this.#argumentPath.members)
      ? this.#argumentPath
      : null
  }
}

function isTypedArrayBasePath(members) {
  return members.length === 0 || (members.length === 1 && members[0] === "prototype")
}
