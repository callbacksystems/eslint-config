// A ternary whose two branches differ in one place duplicates everything around that place: `isOpen ? show(a) :
// show(b)` says the same as `show(isOpen ? a : b)`. Reported for a call varying in one argument, a comparison varying
// on one side, and a computed access varying in the key. A call reached through a property (`api.load(a)`) stands as it
// is, since the ternary would have to move into the receiver and hide which object runs the call. Translation calls are
// the exception the rule makes on purpose: a locale extractor reads the key statically, and `t(isOpen ? "open" :
// "closed")` hides both keys from it.

import { reportProblem } from "#helpers/report"

const TRANSLATION_CALLEES = new Set([ "t", "$t", "__", "translate", "formatMessage", "gettext", "ngettext" ])
const PLAIN_OPERAND_TYPES = new Set([ "Identifier", "Literal", "Super", "ThisExpression" ])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer a ternary around the part that varies over one around the whole expression" },
    schema: [],
    messages: { minimalTernary: "Move the ternary into the part that varies." }
  },
  create(context) {
    return { ConditionalExpression: (node) => reportProblem(context, new Ternary(node, context.sourceCode)) }
  }
}

class Ternary {
  #node
  #sourceCode

  constructor(node, sourceCode) {
    this.#node = node
    this.#sourceCode = sourceCode
  }

  get problem() {
    return this.#pair.isMinimizable ? { node: this.#node, messageId: "minimalTernary" } : null
  }

  get #pair() {
    return new BranchPair(this.#node.consequent, this.#node.alternate, this.#sourceCode)
  }
}

class BranchPair {
  #first
  #second
  #sourceCode

  constructor(first, second, sourceCode) {
    this.#first = first
    this.#second = second
    this.#sourceCode = sourceCode
  }

  get isMinimizable() {
    return this.#isSameShape && (this.#variesInArgument || this.#variesInSide || this.#variesInKey)
  }

  get #isSameShape() {
    return this.#first.type === this.#second.type
  }

  get #variesInArgument() {
    return this.#isType("CallExpression") && this.#hasSharedCallee && this.#hasOneVaryingArgument
  }

  #isType(type) {
    return this.#first.type === type
  }

  get #hasSharedCallee() {
    const { callee } = this.#first
    return isPlainOperand(callee) && !TRANSLATION_CALLEES.has(callee.name)
      && this.#isSameText(callee, this.#second.callee)
  }

  #isSameText(mine, theirs) {
    return this.#sourceCode.getText(mine) === this.#sourceCode.getText(theirs)
  }

  // A spread hides how many arguments there are, and a nested ternary is already the shape this rule asks for.
  get #hasOneVaryingArgument() {
    return this.#first.arguments.every(isPlainArgument) && this.#varyingArguments.length === 1
  }

  get #varyingArguments() {
    return this.#argumentPairs.filter(([ mine, theirs ]) => !this.#isSameText(mine, theirs))
  }

  get #argumentPairs() {
    const theirs = this.#second.arguments
    return this.#hasSameArity ? this.#first.arguments.map((node, index) => [ node, theirs[index] ]) : []
  }

  get #hasSameArity() {
    return this.#first.arguments.length === this.#second.arguments.length
  }

  get #variesInSide() {
    return this.#isType("BinaryExpression") && this.#hasSameOperator && this.#hasOneVaryingSide
      && this.#writesSharedSideOnce
  }

  get #hasSameOperator() {
    return this.#first.operator === this.#second.operator
  }

  get #hasOneVaryingSide() {
    return this.#sharesLeft !== this.#sharesRight
  }

  get #sharesLeft() {
    return this.#isSameText(this.#first.left, this.#second.left)
  }

  get #sharesRight() {
    return this.#isSameText(this.#first.right, this.#second.right)
  }

  // The shared side is written once outside the ternary, where a composed operand would read worse than the ternary.
  get #writesSharedSideOnce() {
    return this.#sharesRight || isPlainOperand(this.#first.left)
  }

  // `config[first] : config[second]` already reads the key dynamically, so `config[test ? first : second]` loses
  // nothing. A static property (`config.a : config.b`) is left alone, since minimizing it forces computed access.
  get #variesInKey() {
    return this.#isType("MemberExpression") && this.#hasSharedObject && !this.#sharesKey
  }

  get #hasSharedObject() {
    return this.#isComputed && isPlainOperand(this.#first.object)
      && this.#isSameText(this.#first.object, this.#second.object)
  }

  get #isComputed() {
    return this.#first.computed && this.#second.computed
  }

  get #sharesKey() {
    return this.#isSameText(this.#first.property, this.#second.property)
  }
}

function isPlainOperand(node) {
  return PLAIN_OPERAND_TYPES.has(node.type)
}

function isPlainArgument(node) {
  return node.type !== "SpreadElement" && node.type !== "ConditionalExpression"
}
