// A long comment block is prose doing work the code should do. Two lines carry the non-obvious why, and past that the
// comment narrates the what, which the reader can already see and which goes stale where the code cannot. The block
// that opens a file says why the file exists, so it gets a little more room. A block inside a `test` or `it` callback
// narrates the scenario, so it has no limit there. Shortening prose is a judgment call, so nothing here is fixable.

import bounds from "binary-search-bounds"
import { nodesIn } from "#helpers/syntax/ast"
import { calleeMemberName } from "#helpers/syntax/classes"
import { commentBlocksIn, locOf } from "#helpers/source/comments"
import { isFunctionLike } from "#helpers/syntax/functions"
import { reportProblems } from "#helpers/eslint/report"
import { byPosition } from "#helpers/syntax/sorting"

const TEST_NAMES = new Set([ "test", "it" ])
const TEST_MODIFIERS = new Set([ "only", "skip" ])

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
  #cachedTestCallbacks

  constructor(sourceCode, { max, headerMax }) {
    this.#sourceCode = sourceCode
    this.#max = max
    this.#headerMax = headerMax
  }

  get problems() {
    return this.#measuredBlocks.map((comments) => this.#problemIn(comments)).filter(Boolean)
  }

  get #measuredBlocks() {
    return this.#blocks.filter((comments) => !this.#isInsideTest(comments))
  }

  get #blocks() {
    return [ ...commentBlocksIn(this.#sourceCode), ...this.#delimitedComments ]
  }

  // A delimited comment counts as one block, so the limit is not sidestepped by switching markers.
  get #delimitedComments() {
    return this.#sourceCode.getAllComments()
      .filter(isDelimitedBlock)
      .map((comment) => [ comment ])
  }

  #isInsideTest(comments) {
    return this.#testCallbacks.includes(comments)
  }

  get #testCallbacks() {
    return this.#cachedTestCallbacks ??= new TestCallbacks(nodesIn(this.#sourceCode)
      .filter(isTestCall)
      .map((call) => call.arguments.at(-1))
      .toArray())
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

// JSDoc is left to `no-jsdoc`, which asks for the whole thing to go rather than for a shorter version of it.
function isDelimitedBlock(comment) {
  return comment.type === "Block" && !comment.value.startsWith("*")
}

class TestCallbacks {
  #starts
  #maximumEnds

  constructor(nodes) {
    const ordered = nodes.toSorted(byPosition)
    this.#starts = ordered.map((node) => node.range[0])
    this.#maximumEnds = new RunningMaximum(ordered.map((node) => node.range[1])).values
  }

  includes(comments) {
    const index = bounds.le(this.#starts, comments[0].range[0])
    return index >= 0 && this.#maximumEnds[index] >= comments.at(-1).range[1]
  }
}

class RunningMaximum {
  #numbers

  constructor(numbers) {
    this.#numbers = numbers
  }

  get values() {
    let maximum = -Infinity
    return this.#numbers.map((number) => maximum = Math.max(maximum, number))
  }
}

function isTestCall(node) {
  return node.type === "CallExpression" && isTestName(node.callee) && isFunctionLike(node.arguments.at(-1))
}

function isTestName(callee) {
  let current = callee
  while (current.type === "MemberExpression") {
    if (!TEST_MODIFIERS.has(calleeMemberName(current))) return false

    current = current.object
  }

  return current.type === "Identifier" && TEST_NAMES.has(current.name)
}

function lineSpanOf(comments) {
  return comments.at(-1).loc.end.line - comments[0].loc.start.line + 1
}
