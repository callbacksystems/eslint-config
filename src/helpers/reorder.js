import { Block } from "#helpers/block"

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
    const run = new Run(nodes.map((node) => this.#blockOf(node)))
    const text = orderedNodes
      .map((node) => this.#blockOf(node))
      .map((block, index, ordered) => block.text + run.separatorAt(index, block, ordered[index + 1]))
      .join("")
    return (fixer) => fixer.replaceTextRange([ run.start, run.end ], text)
  }

  #blockOf(node) {
    return new Block(this.#sourceCode, node)
  }
}

// The blocks as written. A gap holding a comment is a heading over whatever lands below it, so it stays in place;
// an empty gap is decided by the pair landing there: the blank line the author left between them travels with them.
class Run {
  #blocks

  constructor(blocks) {
    this.#blocks = blocks
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
    return written.trim() === "" ? this.#blankLineBetween(block, next) : written
  }

  #blankLineBetween(block, next) {
    const [ first, last ] = [ this.#positionOf(block), this.#positionOf(next) ].sort((left, right) => left - right)
    return this.#gaps.slice(first, last).some(hasBlankLine) ? "\n\n" : "\n"
  }

  #positionOf(block) {
    return this.#blocks.findIndex((candidate) => candidate.start === block.start)
  }

  get #gaps() {
    return this.#blocks.slice(0, -1).map((block, index) => block.gapTo(this.#blocks[index + 1]))
  }
}

function hasBlankLine(gap) {
  return /\n[ \t]*\n/u.test(gap)
}
