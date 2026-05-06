const NEGATION_NEEDS_PARENS = new Set([
  "AssignmentExpression", "BinaryExpression", "ConditionalExpression", "LogicalExpression", "SequenceExpression"
])
const STATEMENT_CONTINUATIONS = new Set([ "[", "(", "`", "+", "-", "/" ])
const STATEMENT_TERMINATORS = new Set([ ";", "{", "}" ])

export function holdsComment(sourceCode, range) {
  return commentsIn(sourceCode, range).length > 0
}

export function commentsIn(sourceCode, range) {
  return sourceCode.getAllComments().filter((comment) => isWithin(comment, range))
}

// For a deletion whose surviving code is below, so the comment reads as written about it.
export function rangeEndingAtFirstComment(sourceCode, range) {
  const comment = commentsIn(sourceCode, range).at(0)
  return comment ? [ range[0], comment.range[0] ] : range
}

// For a deletion whose surviving code is above, so the comment stays under it.
export function rangeStartingAfterLastComment(sourceCode, range) {
  const comment = commentsIn(sourceCode, range).at(-1)
  return comment ? [ comment.range[1], range[1] ] : range
}

export function collapseBlankLines(text) {
  return text.replaceAll(/\n[ \t]*\n/gu, "\n")
}

export function hasBlankBetween(earlier, later) {
  return later.loc.start.line - earlier.loc.end.line > 1
}

export function isOnOwnLine(sourceCode, comment) {
  const before = sourceCode.getTokenBefore(comment, { includeComments: true })
  return !before || before.loc.end.line < comment.loc.start.line
}

export function negated(sourceCode, node) {
  if (node.type === "UnaryExpression" && node.operator === "!") return sourceCode.getText(node.argument)

  const text = sourceCode.getText(node)
  return NEGATION_NEEDS_PARENS.has(node.type) ? `!(${text})` : `!${text}`
}

export function operandText(sourceCode, node, looserTypes) {
  const text = sourceCode.getText(node)
  return looserTypes.has(node.type) ? `(${text})` : text
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

export function closesStatement(token) {
  return !token || STATEMENT_TERMINATORS.has(token.value)
}

// For removing a member whole: each comment inside it survives on a line of its own, above what follows.
export function removalKeepingComments(sourceCode, range) {
  const [ indent ] = /^[ \t]*/u.exec(sourceCode.text.slice(range[0]))
  return commentsIn(sourceCode, range).map((comment) => `${indent}${sourceCode.getText(comment)}\n`).join("")
}

export function replacementKeepingComments(sourceCode, range, text) {
  return new CommentedReplacement(sourceCode, range, text).text
}

function isWithin(comment, [ start, end ]) {
  return comment.range[0] >= start && comment.range[1] <= end
}

class CommentedReplacement {
  #sourceCode
  #range
  #replacement

  constructor(sourceCode, range, replacement) {
    this.#sourceCode = sourceCode
    this.#range = range
    this.#replacement = replacement
  }

  get text() {
    return `${this.#standing}${this.#replacement}${this.#trailing}`
  }

  get #standing() {
    return this.#comments.filter((comment) => this.#standsAlone(comment))
      .map((comment) => `${this.#sourceCode.getText(comment)}\n${this.#indent}`)
      .join("")
  }

  get #comments() {
    return commentsIn(this.#sourceCode, this.#range)
  }

  #standsAlone(comment) {
    return isOnOwnLine(this.#sourceCode, comment)
  }

  get #indent() {
    return " ".repeat(this.#sourceCode.getLocFromIndex(this.#range[0]).column)
  }

  get #trailing() {
    return this.#comments.filter((comment) => !this.#standsAlone(comment))
      .map((comment) => ` ${this.#sourceCode.getText(comment)}`)
      .join("")
  }
}
