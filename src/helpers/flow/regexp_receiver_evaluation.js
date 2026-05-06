import { stableExpressionFor } from "#helpers/flow/stable_expression"
import { ExactRegexpLiteral } from "#helpers/flow/exact_regexp_literal"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"
import { NativeEvaluationInput } from "#helpers/flow/native_evaluation_input"

const FLAG_READS = new Set([
  "dotAll", "global", "hasIndices", "ignoreCase", "multiline", "sticky", "unicode", "unicodeSets"
])

export class RegexpReceiverEvaluation {
  #bindings
  #globals
  #node

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
    this.#globals = new GlobalValueIdentity(bindings)
  }

  get matches() {
    return [ "CallExpression", "NewExpression" ].includes(this.#node?.type)
      && this.#globals.matches(this.#node.callee, "RegExp")
  }

  get isSafe() {
    if (this.#node.arguments.length === 0) return true

    const [ pattern, ...rest ] = this.#node.arguments
    return rest.every((argument) => new NativeEvaluationInput(argument, this.#bindings).isSafe)
      && (new NativeEvaluationInput(pattern, this.#bindings).isSafe || this.#isSafeRegExpPattern)
  }

  isSafeSplitAt(target) {
    return this.#isExactValue && this.#isNativePrototypeMemberAt(Symbol.split, target)
      && this.#hasNativeSpeciesAt(target) && this.#hasNativeFlagsAt(target)
      && this.#isNativePrototypeMemberAt("source", target) && this.#isNativePrototypeMemberAt("exec", target)
  }

  get #isSafeRegExpPattern() {
    return new ExactRegexpLiteral(this.#node.arguments[0], this.#bindings).isPresent
      && this.#hasSafePatternReads
  }

  get #hasSafePatternReads() {
    if (!this.#isNativePrototypeMemberAt(Symbol.match, this.#node)) return false
    if (this.#canReturnPattern) return this.#isNativePrototypeMemberAt("constructor", this.#node)
    return this.#isNativePrototypeMemberAt("source", this.#node)
      && (!this.#hasUndefinedFlags || this.#hasNativeFlagsAt(this.#node))
  }

  #isNativePrototypeMemberAt(member, target) {
    return this.#globals.isIntrinsicUnmodifiedAt(target, "RegExp", [ "prototype", member ])
  }

  get #canReturnPattern() {
    return this.#node.type === "CallExpression" && this.#hasUndefinedFlags
  }

  get #hasUndefinedFlags() {
    const flags = this.#node.arguments[1]
    return !flags || new NativeEvaluationInput(flags, this.#bindings).isUndefined
  }

  #hasNativeFlagsAt(target) {
    return this.#isNativePrototypeMemberAt("flags", target)
      && FLAG_READS.values().every((member) => this.#isNativePrototypeMemberAt(member, target))
  }

  get #isExactValue() {
    return new ExactRegexpLiteral(this.#node, this.#bindings).isPresent
      || this.#isSafeConstruction(stableExpressionFor(this.#node, this.#bindings))
  }

  #isSafeConstruction(value) {
    return [ "CallExpression", "NewExpression" ].includes(value?.type)
      && this.#globals.matches(value.callee, "RegExp")
      && value.arguments.every((argument) => new NativeEvaluationInput(argument, this.#bindings).isSafe)
  }

  #hasNativeSpeciesAt(target) {
    return this.#isNativePrototypeMemberAt("constructor", target)
      && this.#globals.isIntrinsicUnmodifiedAt(target, "RegExp", [ Symbol.species ])
      && this.#isNativePrototypeMemberAt(Symbol.match, target)
  }
}
