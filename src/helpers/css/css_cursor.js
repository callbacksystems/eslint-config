import {
  consumeEscaped, decodeEscaped, findWhiteSpaceEnd, getNewlineLength,
  isIdentifierStart, isName, isNewline, isValidEscape, isWhiteSpace
} from "css-tree/tokenizer"

const PARENTHESIS_DEPTH_CHANGES = { "(": 1, ")": -1 }

export class CssCursor {
  hasSkippedTrivia = false

  #text
  #cursorOffset = 0

  constructor(text) {
    this.#text = text
  }

  get offset() {
    return this.#cursorOffset
  }

  get consumedCharacter() {
    const { character } = this
    this.advance(character.length)
    return this.characterAt(-character.length)
  }

  advance(length = 1) {
    this.#cursorOffset = Math.min(this.#text.length, this.#cursorOffset + length)
  }

  characterAt(offset) {
    return this.#text[this.#cursorOffset + offset] ?? ""
  }

  hasConsumed(character) {
    return this.character === character && this.#hasAdvanced(character.length)
  }

  get character() {
    return this.characterAt(0)
  }

  hasIdentifierAt(offset = 0) {
    return isIdentifierStart(this.#codeAt(offset), this.#codeAt(offset + 1), this.#codeAt(offset + 2))
  }

  get isNameCharacter() {
    return isName(this.#codeAt())
  }

  get isEscape() {
    return isValidEscape(this.#codeAt(), this.#codeAt(1))
  }

  get isQuote() {
    return this.character === "\"" || this.character === "'"
  }

  identifier({ maxLength }) {
    return new CssIdentifierToken(this, maxLength).value
  }

  quotedValue({ maxLength }) {
    return new CssStringToken(this, maxLength).value
  }

  skipQuoted() {
    new CssStringToken(this, 0).skip()
  }

  skipParenthesized() {
    let depth = 0
    do {
      depth += this.#parenthesisDepthChange
      this.#skipSyntax()
    } while (!this.isDone && depth > 0)
  }

  get isDone() {
    return this.#cursorOffset >= this.#text.length
  }

  skipTrivia() {
    this.hasSkippedTrivia = false
    while (this.isWhitespace || this.isCommentStart) {
      this.hasSkippedTrivia = true
      if (this.isWhitespace) {
        this.skipWhitespace()
      } else this.skipComment()
    }
  }

  get isWhitespace() {
    return isWhiteSpace(this.#codeAt())
  }

  get isCommentStart() {
    return this.character === "/" && this.followingCharacter === "*"
  }

  get followingCharacter() {
    return this.characterAt(1)
  }

  skipWhitespace() {
    this.#cursorOffset = findWhiteSpaceEnd(this.#text, this.#cursorOffset)
  }

  skipComment() {
    this.advance(2)
    while (!this.isDone && !this.#isCommentEnd) this.advance()
    if (!this.isDone) this.advance(2)
  }

  skipComments() {
    while (this.isCommentStart) this.skipComment()
  }

  skipAttributeRemainder() {
    while (!this.isDone && this.character !== "]") this.#skipSyntax()
    if (!this.isDone) this.advance()
  }

  escapedValue({ inString = false } = {}) {
    if (isNewline(this.#codeAt(1))) {
      this.advance()
      this.skipNewline()
      return inString ? "" : "�"
    } else {
      const start = this.#cursorOffset + 1
      this.#cursorOffset = Math.min(consumeEscaped(this.#text, this.#cursorOffset), this.#text.length)
      return start === this.#cursorOffset ? "" : decodeEscaped(this.#text.slice(start, this.#cursorOffset))
    }
  }

  skipNewline() {
    this.advance(getNewlineLength(this.#text, this.#cursorOffset, this.#codeAt()))
  }

  #hasAdvanced(length) {
    this.advance(length)
    return true
  }

  #codeAt(offset = 0) {
    // CSS Tree uses zero for EOF; a literal NUL must remain escapable in partial selectors.
    const position = this.#cursorOffset + offset
    return position < this.#text.length ? this.#text.codePointAt(position) || -1 : 0
  }

  get #parenthesisDepthChange() {
    return this.#isStructuralParenthesis ? this.#structuralParenthesisDepthChange : 0
  }

  get #isStructuralParenthesis() {
    return !this.isCommentStart && !this.isQuote && this.character !== "\\"
  }

  get #structuralParenthesisDepthChange() {
    return PARENTHESIS_DEPTH_CHANGES[this.character] ?? 0
  }

  #skipSyntax() {
    if (this.isCommentStart) this.skipComment()
    else if (this.isQuote) this.skipQuoted()
    else if (this.isEscape) this.escapedValue()
    else this.advance(this.character.length)
  }

  get #isCommentEnd() {
    return this.character === "*" && this.followingCharacter === "/"
  }
}

class CssIdentifierToken {
  #cursor
  #value

  constructor(cursor, maxLength) {
    this.#cursor = cursor
    this.#value = new LimitedCssValue(maxLength)
  }

  get value() {
    if (this.#canStart) {
      this.#consumeCurrent()
      while (this.#canContinue) this.#consumeCurrent()
      return this.#value.value
    } else {
      return null
    }
  }

  get #canStart() {
    return this.#cursor.hasIdentifierAt()
  }

  #consumeCurrent() {
    const character = this.#cursor.isEscape
      ? this.#cursor.escapedValue()
      : this.#cursor.consumedCharacter
    this.#value.append(character)
  }

  get #canContinue() {
    return this.#cursor.isNameCharacter || this.#cursor.isEscape
  }
}

class LimitedCssValue {
  #maxLength
  #text = ""
  #isTooLong = false

  constructor(maxLength) {
    this.#maxLength = maxLength
  }

  append(character) {
    if (this.#isTooLong) return

    if (this.#text.length + character.length > this.#maxLength) this.#isTooLong = true
    else this.#text += character
  }

  get value() {
    return this.#isTooLong ? null : this.#text
  }
}

class CssStringToken {
  #cursor
  #quote
  #value

  constructor(cursor, maxLength) {
    this.#cursor = cursor
    this.#quote = cursor.character
    this.#value = new LimitedCssValue(maxLength)
  }

  get value() {
    return this.#consumedValue()
  }

  skip() {
    this.#consumedValue()
  }

  #consumedValue() {
    this.#cursor.advance()
    while (!this.#cursor.isDone && this.#cursor.character !== this.#quote) this.#consumeCurrent()
    const isClosed = this.#cursor.character === this.#quote
    if (isClosed) this.#cursor.advance()
    return isClosed ? this.#value.value : null
  }

  #consumeCurrent() {
    const character = this.#cursor.character === "\\"
      ? this.#cursor.escapedValue({ inString: true })
      : this.#cursor.consumedCharacter
    this.#value.append(character)
  }
}
