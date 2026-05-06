import { asciiLowercaseOf } from "#helpers/strings/ascii"
import { CssCursor } from "#helpers/css/css_cursor"
import { CssNameAttribute } from "#helpers/css/css_name_attribute"
import { CssMatchSet } from "#helpers/css/css_match_set"
import { CssQualifiedName } from "#helpers/css/css_qualified_name"

const RELATIONSHIP_COMBINATORS = new Set([ ">", "+", "~" ])
const SELECTOR_LIST_PSEUDOS = new Set([ "is", "where" ])
const NTH_SELECTOR_PSEUDOS = new Set([ "nth-child", "nth-last-child" ])
const LEGACY_PSEUDO_ELEMENTS = new Set([ "after", "before", "first-letter", "first-line" ])
const MAX_RELEVANT_IDENTIFIER_LENGTH = "nth-last-child".length

export class CssNamedSelector {
  #text
  #name
  #cachedMatches

  constructor(text, { name }) {
    this.#text = text
    this.#name = name
  }

  get hasMeta() {
    return this.#matches.hasNamedMeta
  }

  get hasElement() {
    return this.#matches.hasNamedElement
  }

  get #matches() {
    return this.#cachedMatches ??= new CssSelectorScan(new CssCursor(this.#text), this.#name).matches
  }
}

class CssSelectorScan {
  #cursor
  #name

  constructor(cursor, name) {
    this.#cursor = cursor
    this.#name = name
  }

  get matches() {
    return new CssSelectorStack(this.#cursor, this.#name).matches
  }
}

class CssSelectorStack {
  matches = CssMatchSet.empty

  #frames

  constructor(cursor, name) {
    this.#frames = [ new CssSelectorFrame(cursor, name) ]
    while (this.#frames.length > 0) this.#consumeNext()
  }

  #consumeNext() {
    if (this.#current.isComplete) this.#completeCurrent()
    else this.#consumeCurrentToken()
  }

  get #current() {
    return this.#frames.at(-1)
  }

  #completeCurrent() {
    const matches = this.#current.completedMatches
    this.#frames.pop()
    if (this.#current) this.#current.constrainBy(matches)
    else this.matches = matches
  }

  #consumeCurrentToken() {
    this.#current.consumeNext()
    if (this.#current.nestedFrame) this.#frames.push(this.#current.nestedFrame)
  }
}

class CssSelectorFrame {
  nestedFrame = null

  #cursor
  #name
  #stopsAtParenthesis
  #compound = new CssCompound()
  #matchSet = CssMatchSet.empty

  constructor(cursor, name, { stopsAtParenthesis = false } = {}) {
    this.#cursor = cursor
    this.#name = name
    this.#stopsAtParenthesis = stopsAtParenthesis
  }

  get isComplete() {
    return this.#cursor.isDone || this.#isAtEnd
  }

  get completedMatches() {
    this.#completeSelector()
    if (this.#isAtEnd) this.#cursor.advance()
    return this.#matchSet
  }

  constrainBy(matches) {
    this.#compound.constrainBy(matches)
  }

  consumeNext() {
    this.nestedFrame = null
    if (this.#cursor.isCommentStart) this.#cursor.skipComment()
    else if (this.#cursor.isWhitespace) this.#consumeWhitespace()
    else if (this.#isBoundary) this.#consumeBoundary()
    else if (this.#isNestedSyntax) this.#consumeNestedSyntax()
    else this.#consumeSimpleToken()
  }

  get #isAtEnd() {
    return this.#stopsAtParenthesis && this.#cursor.character === ")"
  }

  #completeSelector() {
    this.#matchSet = this.#matchSet.unionWith(this.#compound.matches)
    this.#compound = new CssCompound()
  }

  #consumeWhitespace() {
    this.#cursor.skipTrivia()
    if (this.#startsDescendant) this.#discardCompound()
  }

  get #startsDescendant() {
    return !this.#cursor.isDone && !this.#isAtEnd && this.#cursor.character !== ","
      && !this.#isRelationshipCombinator
  }

  get #isRelationshipCombinator() {
    return RELATIONSHIP_COMBINATORS.has(this.#cursor.character) || this.#isColumnCombinator
  }

  get #isColumnCombinator() {
    return this.#cursor.character === "|" && this.#cursor.followingCharacter === "|"
  }

  #discardCompound() {
    this.#compound = new CssCompound()
  }

  get #isBoundary() {
    return this.#cursor.character === "," || this.#isRelationshipCombinator
  }

  #consumeBoundary() {
    if (this.#cursor.character === ",") this.#completeSelector()
    else this.#discardCompound()
    this.#cursor.advance(this.#isColumnCombinator ? 2 : 1)
  }

  get #isNestedSyntax() {
    return this.#cursor.character === "[" || this.#cursor.character === ":"
      || this.#cursor.character === "(" || this.#cursor.isQuote
  }

  #consumeNestedSyntax() {
    if (this.#cursor.character === "[") this.#consumeAttribute()
    else if (this.#cursor.character === ":") this.#consumePseudo()
    else if (this.#cursor.character === "(") this.#cursor.skipParenthesized()
    else this.#cursor.skipQuoted()
  }

  #consumeAttribute() {
    this.#compound.omitType()
    if (new CssNameAttribute(this.#cursor, this.#name).isPresent) this.#compound.recognizeName()
  }

  #consumePseudo() {
    this.#compound.omitType()
    const pseudo = new CssPseudo(this.#cursor, this.#name)
    this.nestedFrame = pseudo.nestedFrame
    if (pseudo.isPseudoElement) this.#compound.exclude()
  }

  #consumeSimpleToken() {
    const type = new CssTypeName(this.#cursor)
    this.#compound.recognizeType(type.value)
    if (!type.hasConsumed) this.#cursor.advance(this.#cursor.character.length)
  }
}

class CssCompound {
  #hasSyntax = false
  #isTypePending = true
  #matchSet = CssMatchSet.unconstrained

  get matches() {
    return this.#hasSyntax ? this.#matchSet : CssMatchSet.empty
  }

  recognizeType(name) {
    this.#hasSyntax = true
    if (this.#isTypePending) {
      this.#matchSet = this.#matchSet.constrainedByType(name)
      this.#isTypePending = false
    }
  }

  omitType() {
    this.#hasSyntax = true
    this.#isTypePending = false
  }

  recognizeName() {
    this.#matchSet = this.#matchSet.withName()
  }

  constrainBy(matches) {
    this.#matchSet = this.#matchSet.intersectedWith(matches)
  }

  exclude() {
    this.#matchSet = CssMatchSet.empty
  }
}

class CssPseudo {
  #cursor
  #attributeName
  #isElement
  #name

  constructor(cursor, attributeName) {
    this.#cursor = cursor
    this.#attributeName = attributeName
    cursor.advance()
    this.#isElement = cursor.character === ":"
    if (this.#isElement) cursor.advance()
    this.#name = asciiLowercaseOf(cursor.identifier({ maxLength: MAX_RELEVANT_IDENTIFIER_LENGTH }))
  }

  get nestedFrame() {
    return this.#cursor.character === "(" ? this.#parenthesizedFrame : null
  }

  get isPseudoElement() {
    return this.#isElement || LEGACY_PSEUDO_ELEMENTS.has(this.#name)
  }

  get #parenthesizedFrame() {
    return this.#isSelectorList ? this.#selectorListFrame : this.#nonSelectorListFrame
  }

  get #isSelectorList() {
    return !this.#isElement && SELECTOR_LIST_PSEUDOS.has(this.#name)
  }

  get #selectorListFrame() {
    this.#cursor.advance()
    return new CssSelectorFrame(this.#cursor, this.#attributeName, { stopsAtParenthesis: true })
  }

  get #nonSelectorListFrame() {
    return this.#isNthSelector ? this.#nthSelectorListFrame : this.#skippedParenthesizedFrame
  }

  get #isNthSelector() {
    return !this.#isElement && NTH_SELECTOR_PSEUDOS.has(this.#name)
  }

  get #nthSelectorListFrame() {
    const selectorList = new CssNthSelectorList(this.#cursor)
    return selectorList.isPresent
      ? new CssSelectorFrame(this.#cursor, this.#attributeName, { stopsAtParenthesis: true })
      : null
  }

  get #skippedParenthesizedFrame() {
    this.#cursor.skipParenthesized()
    return null
  }
}

class CssNthSelectorList {
  isPresent = false

  #cursor
  #hasFormula = false

  constructor(cursor) {
    this.#cursor = cursor
    cursor.advance()
    while (this.#isScanning) this.#consumeNext()
    if (!this.isPresent && cursor.character === ")") cursor.advance()
  }

  get #isScanning() {
    return this.#hasFormulaInput && !this.isPresent
  }

  get #hasFormulaInput() {
    return !this.#cursor.isDone && this.#cursor.character !== ")"
  }

  #consumeNext() {
    if (this.#cursor.isWhitespace || this.#cursor.isCommentStart) this.#consumeAfterTrivia()
    else this.#consumeFormulaToken()
  }

  #consumeAfterTrivia() {
    this.#cursor.skipTrivia()
    if (this.#hasFormula && this.#cursor.hasIdentifierAt()) this.#consumePotentialOf()
  }

  #consumePotentialOf() {
    this.isPresent = asciiLowercaseOf(this.#cursor.identifier({ maxLength: "of".length })) === "of"
    if (this.isPresent) this.#cursor.skipTrivia()
    else this.#hasFormula = true
  }

  #consumeFormulaToken() {
    this.#hasFormula = true
    if (this.#cursor.hasIdentifierAt()) this.#cursor.identifier({ maxLength: "of".length })
    else if (this.#cursor.character === "(") this.#cursor.skipParenthesized()
    else if (this.#cursor.character === "[") this.#cursor.skipAttributeRemainder()
    else if (this.#cursor.isQuote) this.#cursor.skipQuoted()
    else this.#cursor.advance(this.#cursor.character.length)
  }
}

class CssTypeName {
  #name

  constructor(cursor) {
    this.#name = new CssQualifiedName(cursor, { maxLength: MAX_RELEVANT_IDENTIFIER_LENGTH })
  }

  get value() {
    if (this.#name.canTargetHtmlElement) {
      return this.#name.hasConsumed ? asciiLowercaseOf(this.#name.value) ?? "" : null
    } else {
      return ""
    }
  }

  get hasConsumed() {
    return this.#name.hasConsumed
  }
}
