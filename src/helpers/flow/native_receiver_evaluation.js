import { ExactTypedArray } from "#helpers/arrays/exact_typed_array"
import { ArrayReceiverEvaluation } from "#helpers/flow/array_receiver_evaluation"
import { CollectionReceiverEvaluation } from "#helpers/flow/collection_receiver_evaluation"
import { ExactIterationSource } from "#helpers/flow/exact_iteration_source"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"
import { NativeEvaluationInput } from "#helpers/flow/native_evaluation_input"
import { RegexpReceiverEvaluation } from "#helpers/flow/regexp_receiver_evaluation"
import { WebCollectionReceiverEvaluation } from "#helpers/flow/web_collection_receiver_evaluation"
import { resolvedPublicMemberNameOf } from "#helpers/classes/resolved_member_key"

const ARRAY_STATICS = new Set([ "from", "of" ])
const BIGINT_TYPED_ARRAYS = new Set([ "BigInt64Array", "BigUint64Array" ])
const OBJECT_ARRAY_STATICS = new Set([ "entries", "keys", "values" ])

// These are language and platform contracts, not guesses: an accepted invocation either stores its arguments without
// coercion or consumes a direct value whose protocol operations are proven native at this point.
export class NativeReceiverEvaluation {
  #context

  constructor(node, bindings) {
    this.#context = new InvocationContext(node, bindings)
  }

  get isSafe() {
    for (const contract of this.#contracts()) {
      if (contract.matches) return contract.isSafe
    }
    return null
  }

  *#contracts() {
    yield new ArrayEvaluation(this.#context)
    yield new ArrayReceiverEvaluation(this.#context)
    yield new TypedArrayEvaluation(this.#context)
    yield new RegexpReceiverEvaluation(this.#context.node, this.#context.bindings)
    yield new PrimitiveConstructionEvaluation(this.#context)
    yield new CollectionReceiverEvaluation(this.#context)
    yield new WebCollectionReceiverEvaluation(this.#context)
    yield new UrlPatternEvaluation(this.#context)
    yield new ObjectArrayEvaluation(this.#context)
    yield new StringSplitEvaluation(this.#context)
  }
}

class InvocationContext {
  #method

  constructor(node, bindings) {
    this.node = node
    this.bindings = bindings
    this.globals = new GlobalValueIdentity(bindings)
  }

  matchesGlobal(globalName) {
    return (this.isCall || this.isNew) && this.globals.matches(this.node.callee, globalName)
  }

  get isCall() {
    return this.node.type === "CallExpression"
  }

  get isNew() {
    return this.node.type === "NewExpression"
  }

  matchesMember(globalName, member = this.method) {
    return this.isCall && this.globals.matches(this.node.callee, globalName, [ member ])
  }

  get method() {
    if (this.#method === undefined) {
      this.#method = this.node.callee.type === "MemberExpression"
        ? resolvedPublicMemberNameOf(this.node.callee, this.bindings)
        : null
    }
    return this.#method
  }
}

class ArrayEvaluation {
  #context

  constructor(context) {
    this.#context = context
  }

  get matches() {
    return this.#context.matchesGlobal("Array") || this.#matchesStatic
  }

  get isSafe() {
    return !this.#matchesStatic || this.#context.method === "of" || this.#isSafeFrom
  }

  get #matchesStatic() {
    return ARRAY_STATICS.has(this.#context.method) && this.#context.matchesMember("Array")
  }

  get #isSafeFrom() {
    const [ source, mapper ] = this.#context.node.arguments
    return Boolean(source) && isAbsentMapper(mapper, this.#context.bindings)
      && new ExactIterationSource(source, { operation: this.#context.node, globals: this.#context.globals }).isSafe
  }
}

function isAbsentMapper(mapper, bindings) {
  return !mapper || new NativeEvaluationInput(mapper, bindings).isUndefined
}

class TypedArrayEvaluation {
  #context
  #globalName

  constructor(context) {
    this.#context = context
  }

  get matches() {
    return (this.#context.isNew || [ "from", "of" ].includes(this.#context.method))
      && Boolean(this.#name)
  }

  get isSafe() {
    if (this.#context.isNew) return this.#isSafeConstruction
    return this.#context.method === "of" ? this.#hasSafeNumericArguments : this.#isSafeFrom
  }

  get #name() {
    return this.#globalName ??= new ExactTypedArray(this.#context.node, this.#context.globals).globalName
  }

  get #isSafeConstruction() {
    const [ source, ...ignored ] = this.#context.node.arguments
    if (source) {
      return ignored.every((argument) => new NativeEvaluationInput(argument, this.#context.bindings).isSafe)
        && (new TypedArrayInput(source, {
          bindings: this.#context.bindings,
          globalName: this.#name
        }).isSafeLength || new NumericIterationSource(source, {
          context: this.#context,
          globalName: this.#name
        }).isSafe)
    } else {
      return true
    }
  }

  get #hasSafeNumericArguments() {
    return this.#context.node.arguments.every((argument) =>
      new TypedArrayInput(argument, { bindings: this.#context.bindings, globalName: this.#name }).isSafeElement)
  }

  get #isSafeFrom() {
    const [ source, mapper ] = this.#context.node.arguments
    return Boolean(source) && isAbsentMapper(mapper, this.#context.bindings)
      && new NumericIterationSource(source, { context: this.#context, globalName: this.#name }).isSafe
  }
}

class TypedArrayInput {
  #bindings
  #globalName
  #node

  constructor(node, { bindings, globalName }) {
    this.#node = node
    this.#bindings = bindings
    this.#globalName = globalName
  }

  get isSafeElement() {
    return BIGINT_TYPED_ARRAYS.has(this.#globalName)
      ? this.#isBigInt || this.#isBoolean || (this.#string !== null && isBigIntString(this.#string))
      : this.#input.isSafe && !this.#isBigInt
  }

  get isSafeLength() {
    return this.#input.isSafe && !this.#isBigInt
  }

  get #isBigInt() {
    return typeof this.#value?.value === "bigint"
      || ([ "-", "~" ].includes(this.#value?.operator)
        && typeof this.#value.argument?.value === "bigint")
  }

  get #value() {
    return this.#node?.type === "Identifier"
      ? this.#bindings.stableValueFor(this.#node) ?? this.#node
      : this.#node
  }

  get #isBoolean() {
    return typeof this.#value?.value === "boolean" || this.#value?.operator === "!"
  }

  get #string() {
    return directStringValueOf(this.#value)
  }

  get #input() {
    return new NativeEvaluationInput(this.#node, this.#bindings)
  }
}

function isBigIntString(value) {
  try {
    BigInt(value)
    return true
  } catch {
    return false
  }
}

function directStringValueOf(node) {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value
  return node?.type === "TemplateLiteral" && node.expressions.length === 0 ? node.quasis[0].value.cooked : null
}

class NumericIterationSource {
  #context
  #globalName
  #source

  constructor(source, { context, globalName }) {
    this.#source = source
    this.#context = context
    this.#globalName = globalName
  }

  get isSafe() {
    return new ExactIterationSource(this.#source, {
      operation: this.#context.node,
      globals: this.#context.globals
    }).isSafe && this.#hasSafeElements
  }

  get #hasSafeElements() {
    return this.#source.type === "ArrayExpression"
      ? this.#source.elements.every((element) => new TypedArrayInput(element, {
        bindings: this.#context.bindings,
        globalName: this.#globalName
      }).isSafeElement)
      : this.#hasSafeStringElements
  }

  get #hasSafeStringElements() {
    return !BIGINT_TYPED_ARRAYS.has(this.#globalName)
      || [ ...directStringValueOf(this.#source) ].every(isBigIntString)
  }
}

class PrimitiveConstructionEvaluation {
  #context
  #globalName

  constructor(context) {
    this.#context = context
    this.#globalName = context.matchesGlobal("String") ? "String" : null
  }

  get matches() {
    return Boolean(this.#globalName)
  }

  get isSafe() {
    return this.#context.node.arguments.every((argument) =>
      new NativeEvaluationInput(argument, this.#context.bindings).isSafe)
  }
}

class UrlPatternEvaluation {
  #context

  constructor(context) {
    this.#context = context
  }

  get matches() {
    return this.#context.isNew && this.#context.globals.matches(this.#context.node.callee, "URLPattern")
  }

  get isSafe() {
    return this.#context.node.arguments.length > 0 && this.#context.node.arguments.every((argument) =>
      new NativeEvaluationInput(argument, this.#context.bindings).isSafe)
  }
}

class ObjectArrayEvaluation {
  #context

  constructor(context) {
    this.#context = context
  }

  get matches() {
    return OBJECT_ARRAY_STATICS.has(this.#context.method) && this.#context.matchesMember("Object")
  }

  get isSafe() {
    const [ source ] = this.#context.node.arguments
    return new DirectOrdinaryObject(source, this.#context.method).isSafe
  }
}

class DirectOrdinaryObject {
  #method
  #node

  constructor(node, method) {
    this.#node = node
    this.#method = method
  }

  get isSafe() {
    if (this.#node?.type === "ArrayExpression") return true
    return this.#node?.type === "ObjectExpression" && this.#node.properties.every((property) =>
      property.type === "Property" && (this.#method === "keys" || property.kind !== "get"))
  }
}

class StringSplitEvaluation {
  #context

  constructor(context) {
    this.#context = context
  }

  get matches() {
    return this.#context.method === "split" && this.#context.node.callee.type === "MemberExpression"
  }

  get isSafe() {
    const { object } = this.#context.node.callee
    return new NativeEvaluationInput(object, this.#context.bindings).isString
      && this.#context.globals.isIntrinsicUnmodifiedAt(this.#context.node.callee, "String", [ "prototype", "split" ])
      && this.#hasSafeLimit && this.#hasSafeSeparator
  }

  get #hasSafeLimit() {
    const limit = this.#context.node.arguments[1]
    return !limit || new NativeEvaluationInput(limit, this.#context.bindings).isSafe
  }

  get #hasSafeSeparator() {
    const [ separator ] = this.#context.node.arguments
    return !separator || new NativeEvaluationInput(separator, this.#context.bindings).isSafe
      || new RegexpReceiverEvaluation(separator, this.#context.bindings)
        .isSafeSplitAt(this.#context.node)
  }
}
