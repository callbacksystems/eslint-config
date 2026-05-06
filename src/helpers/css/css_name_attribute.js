import { asciiLowercaseOf } from "#helpers/strings/ascii"
import { CssQualifiedName } from "#helpers/css/css_qualified_name"

const CSS_FLAGS = new Set([ "i", "s" ])

export class CssNameAttribute {
  #cursor
  #expected

  constructor(cursor, expected) {
    this.#cursor = cursor
    this.#expected = expected
  }

  get isPresent() {
    this.#cursor.advance()
    return [
      this.#isTargetName,
      this.#hasEquality,
      new CssAttributeValue(this.#cursor, this.#expected).isMatching,
      this.#isClosed
    ].every(Boolean)
  }

  get #isTargetName() {
    this.#cursor.skipTrivia()
    return new CssAttributeName(this.#cursor).isTarget
  }

  get #hasEquality() {
    this.#cursor.skipTrivia()
    return this.#cursor.hasConsumed("=")
  }

  get #isClosed() {
    this.#cursor.skipTrivia()
    return this.#cursor.hasConsumed("]") || this.#hasSkippedAttributeRemainder
  }

  get #hasSkippedAttributeRemainder() {
    this.#cursor.skipAttributeRemainder()
    return false
  }
}

class CssAttributeValue {
  #value
  #flag
  #expected

  constructor(cursor, expected) {
    this.#expected = expected
    cursor.skipTrivia()
    const isQuoted = cursor.isQuote
    this.#value = isQuoted
      ? cursor.quotedValue({ maxLength: expected.length })
      : cursor.identifier({ maxLength: expected.length })
    this.#flag = new CssFlag(cursor, { canBeAdjacent: isQuoted })
  }

  get isMatching() {
    return this.#flag.matches(this.#value, { expected: this.#expected })
  }
}

class CssFlag {
  #value

  constructor(cursor, { canBeAdjacent }) {
    cursor.skipTrivia()
    const isAllowedPosition = canBeAdjacent || cursor.hasSkippedTrivia
    this.#value = isAllowedPosition && cursor.hasIdentifierAt()
      ? asciiLowercaseOf(cursor.identifier({ maxLength: 1 })) ?? ""
      : null
  }

  matches(value, { expected }) {
    return value !== null && this.#isAllowed && this.#matchesValue(value, { expected })
  }

  get #isAllowed() {
    return this.#value === null || CSS_FLAGS.has(this.#value)
  }

  #matchesValue(value, { expected }) {
    return this.#value === "i" ? asciiLowercaseOf(value) === expected : value === expected
  }
}

class CssAttributeName {
  #name

  constructor(cursor) {
    this.#name = new CssQualifiedName(cursor, { maxLength: "name".length })
  }

  get isTarget() {
    return asciiLowercaseOf(this.#name.value) === "name" && this.#name.canTargetUnnamespacedAttribute
  }
}
