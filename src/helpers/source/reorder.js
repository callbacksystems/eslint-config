import { Block } from "#helpers/source/block"
import { isToolDirective } from "#helpers/source/comment_directives"
import { commentsIn, lineEndingOf } from "#helpers/source/source"

export function reorderFix(sourceCode, { from, to }) {
  return new Blocks(sourceCode).reorderFix(from, to)
}

export function firstDivergenceBetween(actual, canonical) {
  const index = actual.findIndex((name, position) => name !== canonical[position])
  return index === -1 ? null : { expected: canonical[index], actual: actual[index] }
}

class Blocks {
  #sourceCode

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  reorderFix(nodes, orderedNodes) {
    const run = new Run(nodes.map((node) => this.#blockOf(node)), lineEndingOf(this.#sourceCode))
    if (this.#hasUnselectedSyntaxBetween(nodes)
      || commentsIn(this.#sourceCode, [ run.start, run.end ]).some(hasToolDirective)) return null

    const text = orderedNodes
      .map((node) => this.#blockOf(node))
      .map((block, index, ordered) => block.text + run.separatorAt(index, block, ordered[index + 1]))
      .join("")
    return (fixer) => fixer.replaceTextRange([ run.start, run.end ], text)
  }

  #blockOf(node) {
    return new Block(this.#sourceCode, node)
  }

  #hasUnselectedSyntaxBetween(nodes) {
    return nodes.slice(0, -1)
      .some((node, index) => this.#sourceCode.getTokenAfter(node).range[0] < nodes[index + 1].range[0])
  }
}

// The blocks as written. A gap holding a comment is a heading over whatever lands below it, so it stays in place;
// an empty gap is decided by the pair landing there: the blank line the author left between them travels with them.
class Run {
  #blocks
  #lineEnding
  #cachedGaps
  #cachedPositions
  #cachedBlankLineCounts

  constructor(blocks, lineEnding) {
    this.#blocks = blocks
    this.#lineEnding = lineEnding
  }

  get start() {
    return this.#blocks[0].start
  }

  get end() {
    return this.#blocks.at(-1).end
  }

  separatorAt(index, block, next) {
    return next ? this.#writtenOrDecided(this.#gaps[index], block, next) : ""
  }

  #writtenOrDecided(written, block, next) {
    if (/[\n\r\u{2028}\u{2029}]/u.test(written)) {
      return written.trim() === "" ? this.#blankLineBetween(block, next) : written
    } else {
      // A same-line separator belonged to the old pair. After reordering, a bare space can join two declarations into
      // invalid syntax (`const A = 1 function f() {}`). A native line ending is valid for every statement pair.
      return this.#lineEnding
    }
  }

  #blankLineBetween(block, next) {
    const [ first, last ] = [ this.#positionOf(block), this.#positionOf(next) ].sort((left, right) => left - right)
    return this.#blankLineCounts[last] > this.#blankLineCounts[first]
      ? this.#lineEnding.repeat(2)
      : this.#lineEnding
  }

  #positionOf(block) {
    return this.#positions.get(block.start)
  }

  get #positions() {
    return this.#cachedPositions ??= new Map(this.#blocks.map((block, index) => [ block.start, index ]))
  }

  get #blankLineCounts() {
    if (!this.#cachedBlankLineCounts) {
      let count = 0
      this.#cachedBlankLineCounts = [ 0, ...this.#gaps.map((gap) => count += hasBlankLine(gap) ? 1 : 0) ]
    }
    return this.#cachedBlankLineCounts
  }

  get #gaps() {
    return this.#cachedGaps ??= this.#blocks.slice(0, -1)
      .map((block, index) => block.gapTo(this.#blocks[index + 1]))
  }
}

function hasBlankLine(gap) {
  return /(?:\r\n|[\n\u{2028}\u{2029}]|\r(?!\n))[ \t]*(?:\r\n|[\n\u{2028}\u{2029}]|\r(?!\n))/u.test(gap)
}

function hasToolDirective(comment) {
  return isToolDirective(comment.value)
}
