// Reading and writing source text: inspecting the trivia around a node, and rendering a node back out for a fixer.

const NEGATION_NEEDS_PARENS = new Set([
  "AssignmentExpression", "BinaryExpression", "ConditionalExpression", "LogicalExpression", "SequenceExpression"
])

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

// The mirror: the surviving code is above, so the comment stays under it.
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

// An own-line comment leads the node below rather than trailing code on its line.
export function isOnOwnLine(sourceCode, comment) {
  const before = sourceCode.getTokenBefore(comment, { includeComments: true })
  return !before || before.loc.end.line < comment.loc.start.line
}

// A leading `!` is dropped (double negations cancel), and looser-binding operators are parenthesized.
export function negated(sourceCode, node) {
  if (node.type === "UnaryExpression" && node.operator === "!") return sourceCode.getText(node.argument)

  const text = sourceCode.getText(node)
  return NEGATION_NEEDS_PARENS.has(node.type) ? `!(${text})` : `!${text}`
}

// Parenthesized so it can stand in as an operand of a tighter-binding operator without regrouping.
export function operandText(sourceCode, node, looserTypes) {
  const text = sourceCode.getText(node)
  return looserTypes.has(node.type) ? `(${text})` : text
}

function isWithin(comment, [ start, end ]) {
  return comment.range[0] >= start && comment.range[1] <= end
}
