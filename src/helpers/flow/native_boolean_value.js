import { isStringLiteral } from "#helpers/syntax/ast"
import { ExactTypedArray } from "#helpers/arrays/exact_typed_array"
import { ExactRegexpLiteral } from "#helpers/flow/exact_regexp_literal"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"
import { TypedArrayIntrinsicPath } from "#helpers/arrays/typed_array_intrinsic_path"
import { ReceiverEvaluation } from "#helpers/flow/receiver_evaluation"

const ARRAY_METHODS = new Set([ "every", "includes", "some" ])
const CALLBACKS_RECEIVING_RECEIVER = new Set([ "every", "some" ])
const LENGTH_READ = new Set([ "length" ])
const COLLECTION_GLOBALS = new Set([ "Map", "Set", "WeakMap", "WeakSet" ])
const COLLECTION_METHODS = new Set([ "has" ])
const STRING_METHODS = new Set([ "endsWith", "includes", "startsWith" ])
const TYPED_ARRAY_METHODS = ARRAY_METHODS
const WEB_COLLECTION_GLOBALS = new Set([ "FormData", "Headers", "URLSearchParams" ])

export class NativeBooleanValue {
  #arrays
  #bindings
  #globals
  #node
  #cachedContract

  constructor(node, { arrays, bindings }) {
    this.#node = node
    this.#arrays = arrays
    this.#bindings = bindings
    this.#globals = new GlobalValueIdentity(bindings)
  }

  isBooleanAt(method, target) {
    return this.#isEvaluationSafe && this.hasBooleanContractAt(method, target)
  }

  hasBooleanContractAt(method, target) {
    return this.#contract?.supportsAt(method, target, this.#globals) === true
  }

  isReceiverSafeAt(method, target) {
    return this.#isEvaluationSafe
      && (!CALLBACKS_RECEIVING_RECEIVER.has(method) || this.#isDefinitelyEmptyArray)
      && this.#contract?.isReceiverSafeAt(method, target, this.#globals) === true
  }

  supportsRead(member) {
    return this.#contract?.supportsRead(member) === true
  }

  get isImmutableString() {
    return new ExactStringPrimitive(this.#node, this.#bindings).isPresent
  }

  get #isEvaluationSafe() {
    return new ReceiverEvaluation(this.#node, this.#bindings).isSafe
  }

  get #contract() {
    if (this.#cachedContract === undefined) this.#cachedContract = this.#resolvedContract
    return this.#cachedContract
  }

  get #resolvedContract() {
    if (new ExactStringPrimitive(this.#node, this.#bindings).isPresent) return NativePrototypeContract.string
    if (new ExactRegExpValue(this.#node, this.#bindings, this.#globals).isPresent) return NativePrototypeContract.regExp
    if (new ExactStringObject(this.#node, this.#globals).isPresent) return NativePrototypeContract.string
    if (this.#arrays.isEvident(this.#node)) return NativePrototypeContract.array

    return new ConstructedContract(this.#node, this.#globals).value
  }

  get #isDefinitelyEmptyArray() {
    return this.#node?.type === "ArrayExpression" && this.#node.elements.length === 0
  }
}

class ExactStringPrimitive {
  #bindings
  #node

  constructor(node, bindings) {
    this.#node = node?.type === "Identifier" ? bindings.stableValueFor(node) : node
    this.#bindings = bindings
  }

  get isPresent() {
    return isStringLiteral(this.#node) || this.#node?.type === "TemplateLiteral"
      || new NativeGlobalInvocation(this.#node, this.#globals).isCallOf("String")
  }

  get #globals() {
    return new GlobalValueIdentity(this.#bindings)
  }
}

class NativeGlobalInvocation {
  #globals
  #node

  constructor(node, globals) {
    this.#node = node
    this.#globals = globals
  }

  isCallOf(globalName) {
    return this.#node?.type === "CallExpression" && this.#globals.matches(this.#node.callee, globalName)
  }

  isConstructionOf(globalName) {
    return this.#node?.type === "NewExpression" && this.#globals.matches(this.#node.callee, globalName)
  }
}

class NativePrototypeContract {
  #globalName
  #inheritedGlobalName
  #methods
  #reads

  static get array() {
    return new NativePrototypeContract("Array", ARRAY_METHODS, { reads: LENGTH_READ })
  }

  static get regExp() {
    return new NativePrototypeContract("RegExp", new Set([ "test" ]))
  }

  static get string() {
    return new NativePrototypeContract("String", STRING_METHODS, { reads: LENGTH_READ })
  }

  static get urlPattern() {
    return new NativePrototypeContract("URLPattern", new Set([ "test" ]))
  }

  constructor(globalName, methods, { inheritedGlobalName = null, reads = new Set() } = {}) {
    this.#globalName = globalName
    this.#inheritedGlobalName = inheritedGlobalName
    this.#methods = methods
    this.#reads = reads
  }

  isReceiverSafeAt(method, call, globals) {
    return this.supportsAt(method, call.callee, globals)
      && (this.#globalName !== "RegExp" || method !== "test"
        || globals.isIntrinsicUnmodifiedAt(call, "RegExp", [ "prototype", "exec" ]))
  }

  supportsAt(method, target, globals) {
    const members = [ "prototype", method ]
    return this.supports(method)
      && globals.isIntrinsicUnmodifiedAt(target, this.#globalName, members)
      && (this.#inheritedGlobalName === null
        || globals.isIntrinsicUnmodifiedAt(target, this.#inheritedGlobalName, members))
  }

  supports(method) {
    return this.#methods.has(method)
  }

  supportsRead(member) {
    return this.#reads.has(member)
  }
}

class ExactRegExpValue {
  #bindings
  #globals
  #node

  constructor(node, bindings, globals) {
    this.#node = node
    this.#bindings = bindings
    this.#globals = globals
  }

  get isPresent() {
    if (this.#node?.type === "Literal") return Boolean(this.#node.regex)

    const invocation = new NativeGlobalInvocation(this.#node, this.#globals)
    return invocation.isConstructionOf("RegExp") || new ExactRegExpCall(this.#node, {
      bindings: this.#bindings,
      invocation
    }).isPresent
  }
}

class ExactRegExpCall {
  #bindings
  #invocation
  #node

  constructor(node, { bindings, invocation }) {
    this.#node = node
    this.#bindings = bindings
    this.#invocation = invocation
  }

  get isPresent() {
    return this.#invocation.isCallOf("RegExp") && (this.#hasDefinitelyPresentFlags || this.#hasSafePattern)
  }

  get #hasDefinitelyPresentFlags() {
    return this.#node.arguments.length > 1
      && new DefinitelyPresentPrimitive(this.#node.arguments[1], this.#bindings).isPresent
  }

  get #hasSafePattern() {
    const [ pattern ] = this.#node.arguments
    return !pattern || new RegExpPattern(pattern, this.#bindings).isSafe
  }
}

class DefinitelyPresentPrimitive {
  #node

  constructor(node, bindings) {
    this.#node = node?.type === "Identifier" ? bindings.stableValueFor(node) : node
  }

  get isPresent() {
    return this.#node?.type === "Literal" || this.#node?.type === "TemplateLiteral"
      || (this.#node?.type === "UnaryExpression" && this.#node.operator !== "void")
  }
}

class RegExpPattern {
  #bindings
  #node
  #value

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
    this.#value = node.type === "Identifier" ? bindings.stableValueFor(node) : node
  }

  get isSafe() {
    return this.#isRegExpObject ? this.#isSafeRegExpObject : this.#isPrimitivePattern
  }

  get #isRegExpObject() {
    return this.#value?.type === "Literal" && Boolean(this.#value.regex)
  }

  get #isSafeRegExpObject() {
    return new ExactRegexpLiteral(this.#node, this.#bindings).isPresent
  }

  get #isPrimitivePattern() {
    return this.#value?.type === "Literal" || this.#value?.type === "TemplateLiteral"
      || this.#value?.type === "UnaryExpression"
  }
}

class ExactStringObject {
  #globals
  #node

  constructor(node, globals) {
    this.#node = node
    this.#globals = globals
  }

  get isPresent() {
    return new NativeGlobalInvocation(this.#node, this.#globals).isConstructionOf("String")
  }
}

class ConstructedContract {
  #construction
  #globals
  #node

  constructor(node, globals) {
    this.#node = node
    this.#construction = new ExactGlobalConstruction(node, globals)
    this.#globals = globals
  }

  get value() {
    if (COLLECTION_GLOBALS.has(this.#construction.name)) return contractFor(this.#construction.name)
    if (WEB_COLLECTION_GLOBALS.has(this.#construction.name)) return contractFor(this.#construction.name)
    if (this.#construction.name === "URLPattern") return NativePrototypeContract.urlPattern

    const typedArray = new ExactTypedArray(this.#node, this.#globals).globalName
    return typedArray ? contractFor(typedArray, TYPED_ARRAY_METHODS) : null
  }
}

class ExactGlobalConstruction {
  #globals
  #node

  constructor(node, globals) {
    this.#node = node
    this.#globals = globals
  }

  get name() {
    if (this.#node?.type !== "NewExpression") return null
    return [ ...COLLECTION_GLOBALS, ...WEB_COLLECTION_GLOBALS, "URLPattern" ]
      .find((name) => this.#globals.matches(this.#node.callee, name)) ?? null
  }
}

function contractFor(globalName, methods = COLLECTION_METHODS) {
  const inheritedGlobalName = TypedArrayIntrinsicPath.globalNames.has(globalName)
    ? TypedArrayIntrinsicPath.intrinsicName
    : null
  return new NativePrototypeContract(globalName, methods, { inheritedGlobalName })
}
