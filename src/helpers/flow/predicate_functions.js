import { BooleanReturnAnalysis } from "#helpers/flow/boolean_return_analysis"
import { NativePredicateFunctions } from "#helpers/flow/native_predicate_functions"
import { isBooleanName, isPredicateName } from "#helpers/strings/naming"

export class PredicateFunctions {
  #cachedReturns
  #nativePredicates
  #sourceCode

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
    this.#nativePredicates = new NativePredicateFunctions(sourceCode)
  }

  includes(functionNode, name) {
    return isPredicateName(name)
      || (isBooleanName(name) && (this.#returns.returnsBooleanFrom(functionNode)
        || this.#nativePredicates.includes(functionNode)))
  }

  get #returns() {
    return this.#cachedReturns ??= BooleanReturnAnalysis.for(this.#sourceCode)
  }
}
