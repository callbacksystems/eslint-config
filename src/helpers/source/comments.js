import { isOnOwnLine } from "#helpers/source/source"

export function commentBlocksIn(sourceCode) {
  return new CommentBlocks(ownLineComments(sourceCode)).all
}

// ESLint knows which comments are its directives, so nothing here parses their text.
export function proseCommentsIn(sourceCode) {
  const directives = new Set(sourceCode.getInlineConfigNodes())
  return sourceCode.getAllComments().filter((comment) => comment.type !== "Shebang" && !directives.has(comment))
}

export function locOf(comments) {
  return { start: comments[0].loc.start, end: comments.at(-1).loc.end }
}

class CommentBlocks {
  #comments
  #blocks = []

  constructor(comments) {
    this.#comments = comments
  }

  get all() {
    this.#comments.forEach((comment) => this.#append(comment))
    return this.#blocks
  }

  #append(comment) {
    const current = this.#blocks.at(-1)
    if (current && continues(current.at(-1), comment)) current.push(comment)
    else this.#blocks.push([ comment ])
  }
}

function continues(previous, comment) {
  return comment.loc.start.line === previous.loc.end.line + 1
    && comment.loc.start.column === previous.loc.start.column
}

function ownLineComments(sourceCode) {
  return proseCommentsIn(sourceCode).filter((comment) => comment.type === "Line" && isOnOwnLine(sourceCode, comment))
}
