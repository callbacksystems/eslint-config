// A long comment block is prose doing work the code should do. Two lines carry the non-obvious why, and past that the
// comment narrates the what, which the reader can already see and which goes stale where the code cannot. The block
// that opens a file says why the file exists, so it gets a little more room. Shortening prose is a judgment call, so
// nothing here is fixable.

import { commentBlocksIn, locOf } from "#helpers/comments"
import { reportProblems } from "#helpers/report"
import { isOnOwnLine } from "#helpers/source"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit how many lines a comment block spans" },
    schema: [ {
      type: "object",
      properties: { max: { type: "integer", minimum: 1 }, headerMax: { type: "integer", minimum: 1 } },
      additionalProperties: false
    } ],
    defaultOptions: [ { max: 2, headerMax: 4 } ],
    messages: {
      tooLong: "This comment spans {{count}} lines where {{limit}} is the limit. "
        + "Keep the non-obvious why and drop any narration of the what."
    }
  },
  create(context) {
    return {
      "Program:exit": () => reportProblems(context, new MeasuredComments(context.sourceCode, context.options[0]))
    }
  }
}

class MeasuredComments {
  #sourceCode
  #max
  #headerMax

  constructor(sourceCode, { max, headerMax }) {
    this.#sourceCode = sourceCode
    this.#max = max
    this.#headerMax = headerMax
  }

  get problems() {
    return this.#blocks.map((comments) => this.#problemIn(comments)).filter(Boolean)
  }

  get #blocks() {
    return [ ...commentBlocksIn(this.#sourceCode), ...this.#delimitedComments ]
  }

  // A delimited comment on its own line counts as one block, so the limit is not sidestepped by switching markers.
  get #delimitedComments() {
    return this.#sourceCode.getAllComments()
      .filter((comment) => this.#isDelimitedBlock(comment))
      .map((comment) => [ comment ])
  }

  // JSDoc is left to `no-jsdoc`, which asks for the whole thing to go rather than for a shorter version of it.
  #isDelimitedBlock(comment) {
    return comment.type === "Block" && !comment.value.startsWith("*") && isOnOwnLine(this.#sourceCode, comment)
  }

  #problemIn(comments) {
    const count = lineSpanOf(comments)
    const limit = this.#limitFor(comments)
    return count > limit ? { loc: locOf(comments), messageId: "tooLong", data: { count, limit } } : null
  }

  #limitFor(comments) {
    return this.#opensTheFile(comments[0]) ? this.#headerMax : this.#max
  }

  #opensTheFile(comment) {
    const before = this.#sourceCode.getTokenBefore(comment, { includeComments: true })
    return !before || before.type === "Shebang"
  }
}

function lineSpanOf(comments) {
  return comments.at(-1).loc.end.line - comments[0].loc.start.line + 1
}
