export function containsComment(text) {
  return text.includes("//") || text.includes("/*")
}

export function compactWhitespace(text) {
  return text.replaceAll(/\s+/gu, " ").trim()
}

export function collapseBlankLines(text) {
  return text.replaceAll(/\n[ \t]*\n/gu, "\n")
}

// Whether a node/token sits more than one line below the previous one, i.e. a
// blank line separates them.
export function hasBlankBetween(earlier, later) {
  return later.loc.start.line - earlier.loc.end.line > 1
}

// Whether `comment` stands on its own line (only indentation before it), so it
// leads the node below rather than trailing code on its line.
export function isOnOwnLine(sourceCode, comment) {
  const before = sourceCode.getTokenBefore(comment, { includeComments: true })
  return !before || before.loc.end.line < comment.loc.start.line
}
