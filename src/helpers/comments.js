// The unit a reader sees as one comment: `//` lines on consecutive lines, all starting at the same column.

import { isOnOwnLine } from "#helpers/source"

export function commentBlocksIn(sourceCode) {
  return ownLineComments(sourceCode).reduce(intoBlocks, [])
}

// A directive and a shebang are addressed to the tooling, not the reader. ESLint knows which comments are its own, so
// nothing here parses their text.
export function proseCommentsIn(sourceCode) {
  const directives = new Set(sourceCode.getInlineConfigNodes())
  return sourceCode.getAllComments().filter((comment) => comment.type !== "Shebang" && !directives.has(comment))
}

export function locOf(comments) {
  return { start: comments[0].loc.start, end: comments.at(-1).loc.end }
}

function ownLineComments(sourceCode) {
  return proseCommentsIn(sourceCode).filter((comment) => comment.type === "Line" && isOnOwnLine(sourceCode, comment))
}

function intoBlocks(blocks, comment) {
  const current = blocks.at(-1)
  if (current && continues(current.at(-1), comment)) return [ ...blocks.slice(0, -1), [ ...current, comment ] ]

  return [ ...blocks, [ comment ] ]
}

function continues(previous, comment) {
  return comment.loc.start.line === previous.loc.end.line + 1
    && comment.loc.start.column === previous.loc.start.column
}
