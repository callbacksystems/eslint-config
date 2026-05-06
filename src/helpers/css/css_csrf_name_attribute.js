import { asciiLowercaseOf } from "#helpers/strings/ascii"
import { CssQualifiedName } from "#helpers/css/css_qualified_name"

const CSS_FLAGS = new Set([ "i", "s" ])
const MAX_RELEVANT_IDENTIFIER_LENGTH = "csrf-token".length

export class CssCsrfNameAttribute {
  #cursor

  constructor(cursor) {
    this.#cursor = cursor
  }

  get isPresent() {
    this.#cursor.advance()
    return [
      this.#isTargetName,
      this.#hasEquality,
      new CssAttributeValue(this.#cursor).isCsrfToken,
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

  constructor(cursor) {
    cursor.skipTrivia()
    const isQuoted = cursor.isQuote
    this.#value = isQuoted
      ? cursor.quotedValue({ maxLength: MAX_RELEVANT_IDENTIFIER_LENGTH })
      : cursor.identifier({ maxLength: MAX_RELEVANT_IDENTIFIER_LENGTH })
    this.#flag = new CssFlag(cursor, { canBeAdjacent: isQuoted })
  }

  get isCsrfToken() {
    return this.#flag.matches(this.#value)
  }
}

class CssFlag {
  #value

  constructor(cursor, { canBeAdjacent }) {
    cursor.skipTrivia()
    this.#value = canBeAdjacent || cursor.hasSkippedTrivia
      ? asciiLowercaseOf(cursor.identifier({ maxLength: MAX_RELEVANT_IDENTIFIER_LENGTH }))
      : null
  }

  matches(value) {
    return value !== null && this.#isAllowed && this.#matchesValue(value)
  }

  get #isAllowed() {
    return this.#value === null || CSS_FLAGS.has(this.#value)
  }

  #matchesValue(value) {
    return this.#value === "i" ? asciiLowercaseOf(value) === "csrf-token" : value === "csrf-token"
  }
}

class CssAttributeName {
  #name

  constructor(cursor) {
    this.#name = new CssQualifiedName(cursor, { maxLength: MAX_RELEVANT_IDENTIFIER_LENGTH })
  }

  get isTarget() {
    return asciiLowercaseOf(this.#name.value) === "name" && this.#name.canTargetUnnamespacedAttribute
  }
}
