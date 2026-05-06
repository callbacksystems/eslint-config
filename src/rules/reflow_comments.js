// A comment line that stops mid-sentence while the next word still fits was wrapped to a narrower column than this
// project uses, and costs the reader an extra line for nothing. A break landing on the end of a sentence is left alone:
// that one may be deliberate, and nothing in the source says which. Blocks carrying a list, an indented example, or an
// unbreakable word keep the shape their author gave them.

import { commentBlocksIn, locOf } from "#helpers/source/comments"
import { isToolDirective } from "#helpers/source/comment_directives"
import { lineEndingOf } from "#helpers/source/source"
import { reportProblems } from "#helpers/eslint/report"

const MARKER_WIDTH = "// ".length
const SENTENCE_END = /[.:;!?]["'`)\]]?$/u
const STRUCTURE = /^(?:\s|[-*|>+]|\d+[.)])/u
const CODE_TAIL = /[{(=]$/u
const LABELED = /^[A-Za-z][^:\n]{0,30}:\s/u
const CODE = /^[\w.]+(?:\(|\s+[A-Z]\w*::|\s+:\w|\s+["'`]|\s*=\s)/u

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
    defaultOptions: [ { maxLength: 120 } ],
    messages: {
      narrowWrap: "This comment breaks mid-sentence with room left on the line. Fill it to {{maxLength}} columns."
    }
  },
  create(context) {
    const { maxLength } = context.options[0]
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
    return this.#blocks
      .map((comments) => new Block(comments, this.#maxLength, lineEndingOf(this.#sourceCode)).problem)
      .filter(Boolean)
  }

  get #blocks() {
    return commentBlocksIn(this.#sourceCode).filter((block) => block.length > 1)
  }
}

class Block {
  #comments
  #maxLength
  #lineEnding
  #cachedLines

  constructor(comments, maxLength, lineEnding) {
    this.#comments = comments
    this.#maxLength = maxLength
    this.#lineEnding = lineEnding
  }

  get problem() {
    return this.#hasNarrowWrap
      ? { loc: this.#loc, messageId: "narrowWrap", data: { maxLength: this.#maxLength }, fix: this.#fix }
      : null
  }

  get #hasNarrowWrap() {
    return this.#isProse && this.#lines.some((line, index) => this.#absorbsNext(line, index))
  }

  get #isProse() {
    return this.#lines.every((line) => this.#isProseLine(line))
  }

  get #lines() {
    return this.#cachedLines ??= this.#comments.map((comment) => comment.value.replace(/^ /u, "").trimEnd())
  }

  #isProseLine(line) {
    return !STRUCTURE.test(line)
      && !CODE_TAIL.test(line)
      && !isToolDirective(line)
      && !line.includes("```")
      && line.split(" ").every((word) => this.#widthOf(word) <= this.#maxLength)
  }

  #widthOf(text) {
    return this.#indent + MARKER_WIDTH + text.length
  }

  get #indent() {
    return this.#comments[0].loc.start.column
  }

  #absorbsNext(line, index) {
    const next = this.#lines[index + 1]
    return next ? this.#joins(line, next) : false
  }

  #joins(line, next) {
    return continues(line, next) && this.#widthOf(`${line} ${next.split(" ", 1)[0]}`) <= this.#maxLength
  }

  get #loc() {
    return locOf(this.#comments)
  }

  get #fix() {
    return (fixer) => fixer.replaceTextRange(this.#range, this.#text)
  }

  get #range() {
    return [ this.#comments[0].range[0], this.#comments.at(-1).range[1] ]
  }

  get #text() {
    return this.#paragraphs.flatMap((paragraph) => this.#filled(paragraph))
      .join(`${this.#lineEnding}${" ".repeat(this.#indent)}`)
  }

  get #paragraphs() {
    return new ParagraphBuilder(this.#lines).all
  }

  #filled(paragraph) {
    const words = paragraph.join(" ").split(" ").filter(Boolean)
    return words.length > 0 ? this.#wrapped(words).map((line) => `// ${line}`) : [ "//" ]
  }

  #wrapped(words) {
    return [ ...this.#wrappedLinesFrom(words) ]
  }

  *#wrappedLinesFrom(words) {
    let line = words[0]
    for (const word of words.slice(1)) {
      if (this.#widthOf(`${line} ${word}`) > this.#maxLength) {
        yield line
        line = word
      } else {
        line += ` ${word}`
      }
    }
    yield line
  }
}

// A deliberate break at a sentence end survives, and a line opening with a label or code is an item of its own.
function continues(line, next) {
  return line !== "" && !SENTENCE_END.test(line) && !LABELED.test(next) && !CODE.test(next)
}

class ParagraphBuilder {
  #lines
  #paragraphs = []
  #current = []

  constructor(lines) {
    this.#lines = lines
    this.#lines.forEach((line, index) => this.#append(line, index))
  }

  get all() {
    return this.#paragraphs
  }

  #append(line, index) {
    if (line === "") {
      this.#flush()
      this.#paragraphs.push([ "" ])
    } else {
      this.#current.push(line)
      if (this.#breaksAfter(index)) this.#flush()
    }
  }

  #flush() {
    if (this.#current.length === 0) return

    this.#paragraphs.push(this.#current)
    this.#current = []
  }

  #breaksAfter(index) {
    const next = this.#lines[index + 1]
    return next === undefined || !continues(this.#lines[index], next)
  }
}
