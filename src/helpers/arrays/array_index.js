import { staticMemberKeyOf } from "#helpers/syntax/classes"

const SIGN_OPERATORS = new Set([ "+", "-" ])

export class ArrayIndex {
  #member
  #cachedProperty

  constructor(member) {
    this.#member = member
  }

  get isPossible() {
    return this.#member.computed && (this.#name === null || new ArrayIndexName(this.#name).isValid)
  }

  get #name() {
    return staticMemberKeyOf(this.#member)?.name ?? this.#signedNumericName
  }

  get #signedNumericName() {
    return this.#isSignedNumeric ? String(this.#signedNumericValue) : null
  }

  get #isSignedNumeric() {
    return this.#isSignedExpression && typeof this.#property.argument.value === "number"
  }

  get #isSignedExpression() {
    return this.#property.type === "UnaryExpression" && SIGN_OPERATORS.has(this.#property.operator)
  }

  get #property() {
    return this.#cachedProperty ??= this.#member.property
  }

  get #signedNumericValue() {
    return this.#property.operator === "+" ? +this.#property.argument.value : -this.#property.argument.value
  }
}

class ArrayIndexName {
  #name

  constructor(name) {
    this.#name = name
  }

  get isValid() {
    return /^(?:0|[1-9]\d*)$/u.test(this.#name) ? this.#isWithinRange : false
  }

  get #isWithinRange() {
    const index = Number(this.#name)
    return Number.isSafeInteger(index) && index < 4_294_967_295 && String(index) === this.#name
  }
}
