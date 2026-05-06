import { StandardGlobals } from "#helpers/scope/standard_globals"
import { stableExpressionFor } from "#helpers/flow/stable_expression"

const COERCION_FREE_METHODS = [
  [ "Object", "is" ],
  [ "Array", "isArray" ],
  [ "Number", "isFinite" ],
  [ "Number", "isInteger" ],
  [ "Number", "isNaN" ],
  [ "Number", "isSafeInteger" ]
]

// These contracts inspect values without coercing them, invoking callbacks, or dispatching proxy traps. Calls that
// spread an argument stay unknown because iteration itself can execute user code before the intrinsic runs.
export class StandardPureCall {
  #bindings
  #call
  #globals

  constructor(call, bindings) {
    this.#call = call
    this.#bindings = bindings
    this.#globals = new StandardGlobals(bindings)
  }

  get isPure() {
    return !this.#hasSpreadArgument
      && (this.#isBooleanConversion || this.#isCoercionFreeMethod || this.#isPrimitiveJsonParse)
  }

  get #hasSpreadArgument() {
    return this.#call.arguments.some((argument) => argument.type === "SpreadElement")
  }

  get #isBooleanConversion() {
    return this.#globals.matches(this.#call.callee, "Boolean")
  }

  get #isCoercionFreeMethod() {
    return COERCION_FREE_METHODS.some(([ globalName, method ]) =>
      this.#globals.matches(this.#call.callee, globalName, [ method ]))
  }

  get #isPrimitiveJsonParse() {
    return this.#globals.matches(this.#call.callee, "JSON", [ "parse" ])
      && this.#call.arguments.length === 1
      && isPrimitiveLiteral(stableExpressionFor(this.#call.arguments[0], this.#bindings))
  }
}

function isPrimitiveLiteral(node) {
  return (node?.type === "Literal" && !node.regex)
    || (node?.type === "TemplateLiteral" && node.expressions.length === 0)
}
