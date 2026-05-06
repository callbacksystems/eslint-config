import bounds from "binary-search-bounds"
import { isWithin } from "#helpers/syntax/ranges"
import { byEndPosition, byStartPosition } from "#helpers/syntax/sorting"

const NEGATION_NEEDS_PARENS = new Set([
  "ArrowFunctionExpression", "AssignmentExpression", "BinaryExpression", "ConditionalExpression", "LogicalExpression",
  "SequenceExpression", "YieldExpression"
])
const STATEMENT_CONTINUATIONS = new Set([ "[", "(", "`", "+", "-", "/" ])
const STATEMENT_TERMINATORS = new Set([ ";", "{", "}" ])

export function holdsComment(sourceCode, [ start, end ]) {
  return sourceCode.commentsExistBetween({ range: [ start, start ] }, { range: [ end, end ] })
}

export function commentsIn(sourceCode, [ start, end ]) {
  const comments = sourceCode.getAllComments()
  return comments.slice(bounds.ge(comments, start, byStartPosition), bounds.le(comments, end, byEndPosition) + 1)
}

// For a deletion whose surviving code is above, so the comment stays under it.
export function rangeStartingAfterLastComment(sourceCode, range) {
  const comment = commentsIn(sourceCode, range).at(-1)
  return comment ? [ comment.range[1], range[1] ] : range
}

export function collapseBlankLines(text) {
  return text.replaceAll(
    /(\r\n|[\n\u{2028}\u{2029}]|\r(?!\n))(?:[ \t]*(?:\r\n|[\n\u{2028}\u{2029}]|\r(?!\n)))+/gu,
    "$1"
  )
}

export function hasBlankBetween(earlier, later) {
  return later.loc.start.line - earlier.loc.end.line > 1
}

export function hasCommentBeforeCondition(sourceCode, statement) {
  const keyword = sourceCode.getFirstToken(statement)
  return holdsComment(sourceCode, [ keyword.range[1], sourceCode.getTokenAfter(keyword).range[0] ])
}

export function isOnOwnLine(sourceCode, comment) {
  const before = sourceCode.getTokenBefore(comment, { includeComments: true })
  return !before || before.loc.end.line < comment.loc.start.line
}

export function lineEndingOf(sourceCode) {
  return /\r\n|[\n\r\u{2028}\u{2029}]/u.exec(sourceCode.text)?.[0] ?? "\n"
}

export function nestedCommentText(comments, { sourceCode, indent, lineEnding }) {
  return comments.map((comment) => `${indent}  ${sourceCode.getText(comment)}${lineEnding}`).join("")
}

export function conditionSource(sourceCode, statement) {
  const range = [
    sourceCode.getTokenAfter(sourceCode.getFirstToken(statement)).range[1],
    sourceCode.getTokenBefore(statement.consequent).range[0]
  ]
  return new DelimitedSource(sourceCode, range).value
}

export function returnValueSource(sourceCode, statement) {
  const lastToken = sourceCode.getLastToken(statement)
  const range = [
    sourceCode.getFirstToken(statement).range[1],
    lastToken.value === ";" ? lastToken.range[0] : statement.range[1]
  ]
  return new DelimitedSource(sourceCode, range).value
}

export function negated(sourceCode, node, { text = sourceCode.getText(node) } = {}) {
  return new Negation(sourceCode, node, text).text
}

export function operandText(sourceCode, node, options) {
  return new Operand(sourceCode, node, options).text
}

// In a shorthand property (`{ summary }`) the identifier is the key too, so replacing it alone would drop the key.
export function replaceReference(fixer, identifier, text) {
  const property = identifier.parent
  return property.type === "Property" && property.shorthand
    ? fixer.replaceText(property, `${identifier.name}: ${text}`)
    : fixer.replaceText(identifier, text)
}

// Without semicolons, text opening with one of these reads as a continuation of the line above it.
export function continuesStatement(text) {
  return STATEMENT_CONTINUATIONS.has(text[0])
}

export function commentPreservingReplacementFix(sourceCode, range, options) {
  return (fixer) => fixer.replaceTextRange(range, new CommentedReplacement(sourceCode, range, options).text)
}

export function closesStatement(token) {
  return !token || STATEMENT_TERMINATORS.has(token.value)
}

class DelimitedSource {
  #sourceCode
  #range
  #cachedLastComment

  constructor(sourceCode, range) {
    this.#sourceCode = sourceCode
    this.#range = range
  }

  get value() {
    return { range: this.#range, text: this.#text }
  }

  get #text() {
    const trimmed = this.#raw.trim()
    return this.#endsInLineComment ? `${trimmed}${this.#trailingWhitespace}` : trimmed
  }

  get #raw() {
    return this.#sourceCode.text.slice(...this.#range)
  }

  // The delimiter must stay after the newline rather than becoming part of the comment.
  get #endsInLineComment() {
    return this.#lastComment?.type === "Line" && this.#after(this.#lastComment).trim() === ""
  }

  get #lastComment() {
    return this.#cachedLastComment ??= commentsIn(this.#sourceCode, this.#range).at(-1)
  }

  #after(node) {
    return this.#sourceCode.text.slice(node.range[1], this.#range[1])
  }

  get #trailingWhitespace() {
    return this.#after(this.#lastComment)
  }
}

class Negation {
  #sourceCode
  #node
  #text

  constructor(sourceCode, node, text) {
    this.#sourceCode = sourceCode
    this.#node = node
    this.#text = text
  }

  get text() {
    return this.#isUnwrappable ? this.#unwrapped : this.#wrapped
  }

  get #isUnwrappable() {
    return this.#node.type === "UnaryExpression" && this.#node.operator === "!"
      && this.#text.startsWith(this.#ownText)
  }

  get #ownText() {
    return this.#sourceCode.getText(this.#node)
  }

  get #unwrapped() {
    return `${this.#afterBang}${this.#text.slice(this.#ownText.length)}`
  }

  get #afterBang() {
    return this.#sourceCode.text
      .slice(this.#sourceCode.getFirstToken(this.#node).range[1], this.#node.range[1])
      .trimStart()
  }

  get #wrapped() {
    return NEGATION_NEEDS_PARENS.has(this.#node.type) ? `!(${this.#text})` : `!${this.#text}`
  }
}

class Operand {
  #sourceCode
  #node
  #options

  constructor(sourceCode, node, options) {
    this.#sourceCode = sourceCode
    this.#node = node
    this.#options = options
  }

  get text() {
    return this.#looserTypes.has(this.#node.type) ? `(${this.#source})` : this.#source
  }

  get #looserTypes() {
    return this.#options.looserTypes ?? this.#options
  }

  get #source() {
    return this.#options.text ?? this.#sourceCode.getText(this.#node)
  }
}

class CommentedReplacement {
  #sourceCode
  #range
  #replacement
  #preserving
  #cachedComments

  constructor(sourceCode, range, { text, preserving = [] }) {
    this.#sourceCode = sourceCode
    this.#range = range
    this.#replacement = text
    this.#preserving = preserving
  }

  get text() {
    return `${this.#standing}${this.#replacement}${this.#trailing}`
  }

  get #standing() {
    return this.#comments.filter((comment) => isOnOwnLine(this.#sourceCode, comment))
      .map((comment) => `${this.#sourceCode.getText(comment)}${lineEndingOf(this.#sourceCode)}${this.#indent}`)
      .join("")
  }

  get #comments() {
    return this.#cachedComments ??= commentsIn(this.#sourceCode, this.#range)
      .filter((comment) => !this.#isPreserved(comment))
  }

  #isPreserved(comment) {
    return this.#preserving.some((node) => isWithin(comment, node.range))
  }

  get #indent() {
    return " ".repeat(this.#sourceCode.getLocFromIndex(this.#range[0]).column)
  }

  get #trailing() {
    return this.#comments.filter((comment) => !isOnOwnLine(this.#sourceCode, comment))
      .map((comment) => ` ${this.#sourceCode.getText(comment)}`)
      .join("")
  }
}
