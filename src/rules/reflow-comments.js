// A comment line that stops mid-sentence while the next word still fits was wrapped to a narrower column than this
// project uses, and costs the reader an extra line for nothing. A break landing on the end of a sentence is left alone:
// that one may be deliberate, and nothing in the source says which. Blocks carrying a list, an indented example, or an
// unbreakable word keep the shape their author gave them.

import { reportProblems } from "#helpers/report"
import { isOnOwnLine } from "#helpers/source"

const DEFAULT_MAX_LENGTH = 120
const MARKER_WIDTH = "// ".length
const SENTENCE_END = /[.:;!?]["'`)\]]?$/u
const STRUCTURE = /^(?:\s|[-*|>+]|\d+[.)])/u
const CODE_TAIL = /[{(=]$/u

export default {
  meta: {
    type: "layout",
    fixable: "whitespace",
    docs: { description: "Fill a comment wrapped short of the max width when the break falls mid-sentence" },
    schema: [ {
      type: "object",
      properties: { maxLength: { type: "integer", minimum: 40 } },
      additionalProperties: false
    } ],
    messages: {
      narrowWrap: "This comment breaks mid-sentence with room left on the line. Fill it to {{maxLength}} columns."
    }
  },
  create(context) {
    const maxLength = context.options[0]?.maxLength ?? DEFAULT_MAX_LENGTH
    return { "Program:exit": () => reportProblems(context, new WrappedComments(context.sourceCode, maxLength)) }
  }
}

class WrappedComments {
  #sourceCode
  #maxLength

  constructor(sourceCode, maxLength) {
    this.#sourceCode = sourceCode
    this.#maxLength = maxLength
  }

  get problems() {
    return this.#blocks.map((comments) => new Block(comments, this.#maxLength).problem).filter(Boolean)
  }

  get #blocks() {
    return this.#ownLineComments.reduce(intoBlocks, []).filter((block) => block.length > 1)
  }

  get #ownLineComments() {
    return this.#sourceCode.getAllComments()
      .filter((comment) => comment.type === "Line" && isOnOwnLine(this.#sourceCode, comment))
  }
}

class Block {
  #comments
  #maxLength

  constructor(comments, maxLength) {
    this.#comments = comments
    this.#maxLength = maxLength
  }

  get problem() {
    return this.#hasNarrowWrap
      ? { loc: this.#loc, messageId: "narrowWrap", data: { maxLength: this.#maxLength }, fix: this.#fix }
      : null
  }

  #absorbsNext(line, index) {
    const next = this.#lines[index + 1]
    return next ? this.#joins(line, next) : false
  }

  #joins(line, next) {
    return isOpenBreak(line) && this.#widthOf(`${line} ${next.split(" ", 1)[0]}`) <= this.#maxLength
  }

  #widthOf(text) {
    return this.#indent + MARKER_WIDTH + text.length
  }

  #isProseLine(line) {
    return !STRUCTURE.test(line)
      && !CODE_TAIL.test(line)
      && !line.includes("```")
      && line.split(" ").every((word) => this.#widthOf(word) <= this.#maxLength)
  }

  #filled(paragraph) {
    const words = paragraph.join(" ").split(" ").filter(Boolean)
    return words.length > 0 ? this.#wrapped(words).map((line) => `// ${line}`) : [ "//" ]
  }

  #wrapped(words) {
    return words.reduce((lines, word) => this.#withWord(lines, word), [])
  }

  #withWord(lines, word) {
    const last = lines.at(-1)
    return last !== undefined && this.#widthOf(`${last} ${word}`) <= this.#maxLength
      ? [ ...lines.slice(0, -1), `${last} ${word}` ]
      : [ ...lines, word ]
  }

  get #hasNarrowWrap() {
    return this.#isProse && this.#lines.some((line, index) => this.#absorbsNext(line, index))
  }

  get #isProse() {
    return this.#lines.every((line) => this.#isProseLine(line))
  }

  get #lines() {
    return this.#comments.map((comment) => comment.value.replace(/^ /u, "").trimEnd())
  }

  get #loc() {
    return { start: this.#comments[0].loc.start, end: this.#comments.at(-1).loc.end }
  }

  get #fix() {
    return (fixer) => fixer.replaceTextRange(this.#range, this.#text)
  }

  get #range() {
    return [ this.#comments[0].range[0], this.#comments.at(-1).range[1] ]
  }

  get #text() {
    return this.#paragraphs.flatMap((paragraph) => this.#filled(paragraph)).join(`\n${" ".repeat(this.#indent)}`)
  }

  // A sentence boundary and a blank line each close a paragraph, so only the mid-sentence breaks are redrawn.
  get #paragraphs() {
    return this.#lines.reduce(intoParagraphs, [ [] ]).filter((paragraph) => paragraph.length > 0)
  }

  get #indent() {
    return this.#comments[0].loc.start.column
  }
}

// Only a break that leaves a sentence unfinished is redrawn, so a deliberate one survives.
function isOpenBreak(line) {
  return line !== "" && !SENTENCE_END.test(line)
}

function intoParagraphs(paragraphs, line) {
  if (line === "") return [ ...paragraphs, [ "" ], [] ]

  const grown = [ ...paragraphs.slice(0, -1), [ ...paragraphs.at(-1), line ] ]
  return SENTENCE_END.test(line) ? [ ...grown, [] ] : grown
}

// A block is what the reader sees as one comment: `//` lines on consecutive lines, all starting at the same column.
function intoBlocks(blocks, comment) {
  const current = blocks.at(-1)
  if (current && continues(current.at(-1), comment)) return [ ...blocks.slice(0, -1), [ ...current, comment ] ]

  return [ ...blocks, [ comment ] ]
}

function continues(previous, comment) {
  return comment.loc.start.line === previous.loc.end.line + 1
    && comment.loc.start.column === previous.loc.start.column
}
