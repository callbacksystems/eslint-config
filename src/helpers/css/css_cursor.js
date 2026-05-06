const MAX_HEX_DIGITS = 6
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
    return new CssIdentifierStart(this, offset).isPresent
  }

  get isNewline() {
    return /[\n\r\f]/u.test(this.character)
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
    return isCssWhitespace(this.character)
  }

  get isCommentStart() {
    return this.character === "/" && this.followingCharacter === "*"
  }

  get followingCharacter() {
    return this.characterAt(1)
  }

  skipWhitespace() {
    while (this.isWhitespace) this.advance()
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

  skipEscapeWhitespace() {
    if (this.character === "\r" && this.followingCharacter === "\n") this.advance(2)
    else if (this.isWhitespace) this.advance()
  }

  skipNewline() {
    if (this.character === "\r" && this.followingCharacter === "\n") this.advance(2)
    else this.advance()
  }

  #hasAdvanced(length) {
    this.advance(length)
    return true
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
    else if (this.character === "\\" && isEscapable(this.followingCharacter)) new CssEscape(this).skip()
    else this.advance(this.character.length)
  }

  get #isCommentEnd() {
    return this.character === "*" && this.followingCharacter === "/"
  }
}

class CssIdentifierStart {
  #cursor
  #offset

  constructor(cursor, offset) {
    this.#cursor = cursor
    this.#offset = offset
  }

  get isPresent() {
    return this.#isSimple || this.#isDashed
  }

  get #isSimple() {
    return isCssNameStart(this.#character) || this.#isValidEscapeAt(this.#offset)
  }

  get #character() {
    return this.#cursor.characterAt(this.#offset)
  }

  #isValidEscapeAt(offset) {
    return this.#cursor.characterAt(offset) === "\\" && isEscapable(this.#cursor.characterAt(offset + 1))
  }

  get #isDashed() {
    if (this.#character !== "-") return false

    return this.#followingCharacter === "-" || isCssNameStart(this.#followingCharacter)
      || this.#isValidEscapeAt(this.#offset + 1)
  }

  get #followingCharacter() {
    return this.#cursor.characterAt(this.#offset + 1)
  }
}

function isCssNameStart(character) {
  return /[A-Z_a-z]/u.test(character) || (character.codePointAt(0) ?? 0) >= 0x80
}

function isEscapable(character) {
  return Boolean(character) && !/[\n\r\f]/u.test(character)
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
    const character = this.#isValidEscape
      ? new CssEscape(this.#cursor).value
      : this.#cursor.consumedCharacter
    this.#value.append(character)
  }

  get #isValidEscape() {
    return this.#cursor.character === "\\" && isEscapable(this.#cursor.followingCharacter)
  }

  get #canContinue() {
    return this.#isNameStart || this.#isDigit || this.#cursor.character === "-" || this.#isValidEscape
  }

  get #isNameStart() {
    return isCssNameStart(this.#cursor.character)
  }

  get #isDigit() {
    return /\d/u.test(this.#cursor.character)
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

class CssEscape {
  #cursor
  #inString

  constructor(cursor, { inString = false } = {}) {
    this.#cursor = cursor
    this.#inString = inString
  }

  get value() {
    return this.#consumedValue()
  }

  skip() {
    this.#consumedValue()
  }

  #consumedValue() {
    this.#cursor.advance()
    return this.#isHexDigit ? this.#hexValue : this.#nonHexValue
  }

  get #isHexDigit() {
    return /[0-9a-f]/iu.test(this.#cursor.character)
  }

  get #hexValue() {
    let codePoint = 0
    let digits = 0
    while (digits < MAX_HEX_DIGITS && this.#isHexDigit) {
      codePoint = (codePoint * 16) + Number.parseInt(this.#cursor.character, 16)
      this.#cursor.advance()
      digits += 1
    }
    this.#cursor.skipEscapeWhitespace()
    return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : "�"
  }

  get #nonHexValue() {
    return this.#cursor.isNewline ? this.#newlineValue : this.#cursor.consumedCharacter
  }

  get #newlineValue() {
    this.#cursor.skipNewline()
    return this.#inString ? "" : "�"
  }
}

function isValidCodePoint(codePoint) {
  return codePoint > 0 && codePoint <= 0x10FFFF && !(codePoint >= 0xD800 && codePoint <= 0xDFFF)
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
      ? new CssEscape(this.#cursor, { inString: true }).value
      : this.#cursor.consumedCharacter
    this.#value.append(character)
  }
}

function isCssWhitespace(character) {
  return /[\t\n\f\r ]/u.test(character)
}
