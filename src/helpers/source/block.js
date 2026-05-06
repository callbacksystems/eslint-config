// A node travels with the own-line comments right above it, its trailing comment and its indent. A comment run
// separated from the node by a blank line is a heading rather than a note on it, so it stays.

import { isFileDirective } from "#helpers/source/comment_directives"
import { isOnOwnLine } from "#helpers/source/source"

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
    const lineStart = anchor.range[0] - anchor.loc.start.column
    return this.#sourceCode.text.slice(lineStart, anchor.range[0]).trim() === "" ? lineStart : anchor.range[0]
  }

  get end() {
    return (this.#trailingComment ?? this.#node).range[1]
  }

  gapTo(next) {
    return this.#sourceCode.text.slice(this.end, next.start)
  }

  get #attachedCommentsAbove() {
    return new CommentAttachment(this.#node).from(this.#ownLineCommentsBefore)
  }

  get #ownLineCommentsBefore() {
    return this.#sourceCode.getCommentsBefore(this.#node)
      .filter((comment) => comment.type !== "Shebang"
        && !isFileDirective(comment.value.trim())
        && isOnOwnLine(this.#sourceCode, comment))
  }

  get #trailingComment() {
    return this.#sourceCode.getCommentsAfter(this.#node).findLast(startingOnLine(this.#node.loc.end.line))
  }
}

class CommentAttachment {
  #below
  #attached = []
  #accepting = true

  constructor(node) {
    this.#below = node
  }

  from(comments) {
    comments.toReversed().forEach((comment) => this.#attach(comment))
    return this.#attached
  }

  #attach(comment) {
    if (this.#accepting) {
      this.#accepting = isRightAbove(comment, this.#below)
      if (this.#accepting) {
        this.#attached.unshift(comment)
        this.#below = comment
      }
    }
  }
}

function isRightAbove(comment, below) {
  return comment.loc.end.line === below.loc.start.line - 1
}

function startingOnLine(line) {
  return (comment) => comment.loc.start.line === line
}
