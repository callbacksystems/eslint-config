const IMPLICIT_NAMESPACE = Symbol("implicit namespace")
const NO_NAMESPACE = Symbol("no namespace")
const UNKNOWN_NAMESPACE = Symbol("unknown namespace")

export class CssQualifiedName {
  #cursor
  #start
  #maxLength
  #namespace = IMPLICIT_NAMESPACE
  #parsedValue

  constructor(cursor, { maxLength = Infinity } = {}) {
    this.#cursor = cursor
    this.#start = cursor.offset
    this.#maxLength = maxLength
    const first = new CssName(cursor, maxLength)
    cursor.skipComments()
    if (this.#isNamespaceDelimiter) this.#consumeNamespace(first)
    else this.#parsedValue = first.value
  }

  get value() {
    return this.#parsedValue
  }

  get hasConsumed() {
    return this.#cursor.offset > this.#start
  }

  get canTargetUnnamespacedAttribute() {
    return this.canTargetHtmlElement || this.#namespace === NO_NAMESPACE
  }

  get canTargetHtmlElement() {
    return this.#namespace === IMPLICIT_NAMESPACE || this.#namespace === "*"
  }

  get #isNamespaceDelimiter() {
    return this.#cursor.character === "|" && ![ "|", "=" ].includes(this.#cursor.followingCharacter)
  }

  #consumeNamespace(first) {
    this.#namespace = first.hasConsumed ? first.value ?? UNKNOWN_NAMESPACE : NO_NAMESPACE
    this.#cursor.advance()
    this.#cursor.skipComments()
    this.#parsedValue = new CssName(this.#cursor, this.#maxLength).value
  }
}

class CssName {
  hasConsumed = false
  value = null

  constructor(cursor, maxLength) {
    const isUniversal = cursor.character === "*"
    this.hasConsumed = isUniversal || cursor.hasIdentifierAt()
    if (isUniversal) cursor.advance()
    this.value = isUniversal ? "*" : cursor.identifier({ maxLength })
  }
}
