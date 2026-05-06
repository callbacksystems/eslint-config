import { stableExpressionFor } from "#helpers/flow/stable_expression"

export class NativeSplitResult {
  #analysis
  #call

  constructor(call, analysis) {
    this.#call = call
    this.#analysis = analysis
  }

  get isArray() {
    const [ separator ] = this.#call.arguments
    return !separator || new ExactSplitSeparator(separator, this.#call, this.#analysis).keepsArrayResult
  }
}

class ExactSplitSeparator {
  #bindings
  #call
  #globals
  #separator

  constructor(separator, call, { bindings, globals }) {
    this.#separator = separator
    this.#call = call
    this.#bindings = bindings
    this.#globals = globals
  }

  get keepsArrayResult() {
    if (new FreshRegExp(this.#separator, this.#globals).isPresent) return this.#hasNativeHookOn("RegExp")

    const { prototypeNames } = new PrimitiveSeparator(this.#separator, this.#bindings)
    return prototypeNames !== null && prototypeNames.every((name) => this.#hasNativeHookOn(name))
  }

  #hasNativeHookOn(globalName) {
    return this.#globals.isIntrinsicUnmodifiedAt(this.#call, globalName, [ "prototype", Symbol.split ])
  }
}

class FreshRegExp {
  #globals
  #node

  constructor(node, globals) {
    this.#node = node
    this.#globals = globals
  }

  get isPresent() {
    return this.#isLiteral || (this.#node?.type === "NewExpression" && this.#isRegExpConstruction)
  }

  get #isLiteral() {
    return this.#node?.type === "Literal" && Boolean(this.#node.regex)
  }

  get #isRegExpConstruction() {
    const { callee } = this.#node
    return this.#globals.matches(callee, "RegExp")
  }
}

class PrimitiveSeparator {
  #bindings
  #value

  constructor(node, bindings) {
    this.#value = stableExpressionFor(node, bindings)
    this.#bindings = bindings
  }

  get prototypeNames() {
    return new NullishPrimitive(this.#value, this.#bindings).isPresent
      ? []
      : primitivePrototypeNamesOf(this.#value)
  }
}

class NullishPrimitive {
  #bindings
  #node

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
  }

  get isPresent() {
    return this.#isNullLiteral || this.#isVoidExpression || this.#isGlobalUndefined
  }

  get #isNullLiteral() {
    return this.#node.type === "Literal" && this.#node.value === null
  }

  get #isVoidExpression() {
    return this.#node.type === "UnaryExpression" && this.#node.operator === "void"
  }

  get #isGlobalUndefined() {
    return this.#node.type === "Identifier" && this.#bindings.globalNameFor(this.#node) === "undefined"
  }
}

function primitivePrototypeNamesOf(node) {
  if (node.type === "TemplateLiteral") return withObjectPrototype("String")
  if (node.type === "Literal") return literalPrototypeNamesOf(node)
  return node.type === "UnaryExpression" ? unaryPrototypeNamesOf(node) : null
}

function withObjectPrototype(globalName) {
  return [ globalName, "Object" ]
}

function literalPrototypeNamesOf({ value }) {
  const name = primitivePrototypeNameOf(value)
  return name === null ? null : withObjectPrototype(name)
}

function primitivePrototypeNameOf(value) {
  if (typeof value === "string") return "String"
  if (typeof value === "number") return "Number"
  if (typeof value === "boolean") return "Boolean"
  return typeof value === "bigint" ? "BigInt" : null
}

function unaryPrototypeNamesOf({ operator }) {
  if ([ "!", "delete" ].includes(operator)) return withObjectPrototype("Boolean")
  if (operator === "typeof") return withObjectPrototype("String")
  if (operator === "+") return withObjectPrototype("Number")
  return [ "Number", "BigInt", "Object" ]
}
