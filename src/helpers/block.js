// A node travels with the own-line comments right above it, its trailing comment and its indent. A comment run
// separated from the node by a blank line is a heading rather than a note on it, so it stays.

import { isOnOwnLine } from "#helpers/source"

export class Block {
  #sourceCode
  #node

  constructor(sourceCode, node) {
    this.#sourceCode = sourceCode
    this.#node = node
  }

  get text() {
    return this.#sourceCode.text.slice(this.start, this.end)
  }

  get start() {
    const anchor = this.#attachedCommentsAbove[0] ?? this.#node
    return anchor.range[0] - anchor.loc.start.column
  }

  get end() {
    return (this.#trailingComment ?? this.#node).range[1]
  }

  gapTo(next) {
    return this.#sourceCode.text.slice(this.end, next.start)
  }

  get #attachedCommentsAbove() {
    return this.#ownLineCommentsBefore.reduceRight((attached, comment) => this.#attach(attached, comment), [])
  }

  get #ownLineCommentsBefore() {
    return this.#sourceCode.getCommentsBefore(this.#node)
      .filter((comment) => isOnOwnLine(this.#sourceCode, comment))
  }

  #attach(attached, comment) {
    return isRightAbove(comment, attached[0] ?? this.#node) ? [ comment, ...attached ] : []
  }

  get #trailingComment() {
    return this.#sourceCode.getCommentsAfter(this.#node).find(startingOnLine(this.#node.loc.end.line))
  }
}

function isRightAbove(comment, below) {
  return comment.loc.end.line === below.loc.start.line - 1
}

function startingOnLine(line) {
  return (comment) => comment.loc.start.line === line
}
