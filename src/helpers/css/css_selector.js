import { isStringLiteral } from "#helpers/syntax/ast"
import { asciiLowercaseOf } from "#helpers/strings/ascii"
import { CssCursor } from "#helpers/css/css_cursor"
import { CssQualifiedName } from "#helpers/css/css_qualified_name"

export class CssSelector {
  #text
  #requiresClosedAttributes
  #cachedHasClass
  #cachedHasClassAttribute

  static from(node) {
    const text = selectorTextOf(node)
    return text === null ? null : new CssSelector(text)
  }

  static fromStaticPrefix(node) {
    const text = staticPrefixTextOf(node)
    return text === null
      ? null
      : new CssSelector(text, { requiresClosedAttributes: hasDynamicTemplateParts(node) })
  }

  constructor(text, { requiresClosedAttributes = false } = {}) {
    this.#text = text
    this.#requiresClosedAttributes = requiresClosedAttributes
  }

  get hasClass() {
    return this.#cachedHasClass ??= new CssClassScan(this.#text).hasClass
  }

  get hasClassAttribute() {
    return this.#cachedHasClassAttribute ??= this.attributeMatching(isClassAttribute) !== null
  }

  attributeMatching(predicate) {
    return new MatchingCssAttribute(this.#text, predicate, {
      requiresClosedAttributes: this.#requiresClosedAttributes
    }).value
  }

  get attributeNames() {
    return new CssAttributeNames(this.#text, { requiresClosedAttributes: this.#requiresClosedAttributes }).values
  }
}

function selectorTextOf(node) {
  if (isStringLiteral(node)) return node.value
  if (node?.type !== "TemplateLiteral") return null

  return node.quasis.map(staticTextOf).join("x")
}

function staticTextOf(quasi) {
  return quasi.value.cooked ?? quasi.value.raw
}

function staticPrefixTextOf(node) {
  if (isStringLiteral(node)) return node.value
  return node?.type === "TemplateLiteral" ? staticTextOf(node.quasis[0]) : null
}

function hasDynamicTemplateParts(node) {
  return node?.type === "TemplateLiteral" && node.expressions.length > 0
}

class CssClassScan {
  #cursor
  #bracketDepth = 0
  #hasClass = false

  constructor(text) {
    this.#cursor = new CssScanCursor(text)
  }

  get hasClass() {
    while (!this.#cursor.isDone && !this.#hasClass) this.#consumeCurrent()
    return this.#hasClass
  }

  #consumeCurrent() {
    if (this.#cursor.isStructural) this.#consumeStructure()
    this.#cursor.skipSyntax()
  }

  #consumeStructure() {
    if (this.#cursor.character === "[") this.#bracketDepth += 1
    else if (this.#cursor.character === "]") this.#bracketDepth = Math.max(0, this.#bracketDepth - 1)
    else if (this.#bracketDepth === 0) this.#hasClass = this.#cursor.isClassStart
  }
}

class CssScanCursor {
  #cursor
  #maximumIdentifierLength
  #requiresClosedAttributes

  constructor(text, { requiresClosedAttributes = false } = {}) {
    this.#cursor = new CssCursor(text)
    this.#maximumIdentifierLength = text.length
    this.#requiresClosedAttributes = requiresClosedAttributes
  }

  get isDone() {
    return this.#cursor.isDone
  }

  get isClassStart() {
    return this.character === "." && this.#cursor.hasIdentifierAt(1)
  }

  get character() {
    return this.#cursor.character
  }

  get isOpeningBracket() {
    return this.isStructural && this.character === "["
  }

  get isStructural() {
    return !this.#cursor.isCommentStart && !this.#cursor.isQuote && this.character !== "\\"
  }

  get attributeName() {
    return new CssAttribute(this, { requiresClosure: this.#requiresClosedAttributes }).name
  }

  get qualifiedName() {
    return new CssQualifiedName(this.#cursor, { maxLength: this.#maximumIdentifierLength }).value
  }

  advance(length = 1) {
    this.#cursor.advance(length)
  }

  skipTrivia() {
    this.#cursor.skipTrivia()
  }

  skipSyntax() {
    if (this.#cursor.isCommentStart) this.#cursor.skipComment()
    else if (this.#cursor.isQuote) this.#cursor.skipQuoted()
    else if (this.character === "\\") this.#skipEscape()
    else this.#cursor.advance()
  }

  #skipEscape() {
    new CssEscapedSyntax(this.#cursor).skip()
  }
}

class CssAttribute {
  #cursor
  #name
  #requiresClosure

  constructor(cursor, { requiresClosure }) {
    this.#cursor = cursor
    this.#requiresClosure = requiresClosure
  }

  get name() {
    this.#cursor.advance()
    this.#cursor.skipTrivia()
    this.#name = this.#cursor.qualifiedName
    return new CssAttributeClosure(this.#cursor).isClosed || !this.#requiresClosure ? this.#name : null
  }
}

class CssAttributeClosure {
  #cursor
  #isClosed = false

  constructor(cursor) {
    this.#cursor = cursor
  }

  get isClosed() {
    while (!this.#cursor.isDone && this.#cursor.character !== "]") this.#cursor.skipSyntax()
    if (!this.#cursor.isDone) this.#close()
    return this.#isClosed
  }

  #close() {
    this.#cursor.advance()
    this.#isClosed = true
  }
}

class CssEscapedSyntax {
  #cursor
  #initialOffset

  constructor(cursor) {
    this.#cursor = cursor
    this.#initialOffset = cursor.offset
  }

  skip() {
    this.#cursor.identifier({ maxLength: 0 })
    if (this.#cursor.offset === this.#initialOffset) this.#cursor.advance()
  }
}

function isClassAttribute(name) {
  return asciiLowercaseOf(name) === "class"
}

class MatchingCssAttribute {
  #attributes
  #predicate
  #value = null

  constructor(text, predicate, options) {
    this.#attributes = new CssAttributes(text, options)
    this.#predicate = predicate
  }

  get value() {
    while (!this.#attributes.isDone && this.#value === null) this.#inspectNext()
    return this.#value
  }

  #inspectNext() {
    const name = this.#attributes.nextName
    if (name !== null && this.#predicate(name)) this.#value = name
  }
}

class CssAttributes {
  #cursor
  #nextName = null

  constructor(text, options) {
    this.#cursor = new CssScanCursor(text, options)
  }

  get nextName() {
    this.#nextName = null
    while (!this.isDone && this.#nextName === null) this.#consumeNext()
    return this.#nextName
  }

  get isDone() {
    return this.#cursor.isDone
  }

  #consumeNext() {
    if (this.#cursor.isOpeningBracket) this.#nextName = this.#cursor.attributeName
    else this.#cursor.skipSyntax()
  }
}

class CssAttributeNames {
  #attributes
  #values = []

  constructor(text, options) {
    this.#attributes = new CssAttributes(text, options)
  }

  get values() {
    while (!this.#attributes.isDone) this.#appendNext()
    return this.#values
  }

  #appendNext() {
    const name = this.#attributes.nextName
    if (name !== null) this.#values.push(name)
  }
}
