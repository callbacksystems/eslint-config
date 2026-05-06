// Section-divider comments (rows of repeated `-=*_~#`, or a label wrapped in them) add no information and just chop the
// file up visually. Structure comes from functions and modules, not banners. Pure dividers are removed; decorated text
// is unwrapped to a plain comment.

import { reportProblem } from "#helpers/report"

// Divider characters: ASCII (`-=*_~#`), em/en-dash, and the full Box Drawing (U+2500-U+257F) plus Block Elements
// (U+2580-U+259F) Unicode blocks.
const DIVIDER_CHARS_ONLY = /^[\s\-=*_~#\u2013\u2014\u2500-\u259F]+$/u
const HAS_DIVIDER_RUN = /[-=*_~#\u2013\u2014\u2500-\u259F]{2,}/u
const LEADING_DIVIDER_RUN = /^[-=*_~#\u2013\u2014\u2500-\u259F]+/u

export default {
  meta: {
    type: "problem",
    fixable: "code",
    docs: { description: "Disallow ASCII-art section divider comments" },
    schema: [],
    messages: {
      pureDivider: "Section-divider comments add no information. Remove.",
      wrappedDivider: "Strip ASCII divider decorations; keep the inner text as a normal comment."
    }
  },
  create(context) {
    const { sourceCode } = context
    return {
      Program() {
        sourceCode.getAllComments().forEach((comment) =>
          reportProblem(context, new DividerComment(comment, sourceCode)))
      }
    }
  }
}

class DividerComment {
  #comment
  #sourceCode

  constructor(comment, sourceCode) {
    this.#comment = comment
    this.#sourceCode = sourceCode
  }

  get problem() {
    const classification = classify(this.#comment.value)
    return classification ? this.#problemFor(classification) : null
  }

  #problemFor(result) {
    return result.kind === "pure" ? this.#pureProblem : this.#wrappedProblem(result.innerText)
  }

  #wrappedProblem(innerText) {
    return {
      node: this.#comment,
      messageId: "wrappedDivider",
      fix: (fixer) => fixer.replaceTextRange(this.#comment.range, rebuildComment(this.#comment, innerText))
    }
  }

  get #pureProblem() {
    return {
      node: this.#comment,
      messageId: "pureDivider",
      fix: (fixer) => fixer.removeRange(new SourceText(this.#sourceCode.text).removalRangeFor(this.#comment))
    }
  }
}

function classify(text) {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (DIVIDER_CHARS_ONLY.test(trimmed) && HAS_DIVIDER_RUN.test(trimmed)) return { kind: "pure" }

  const innerText = wrappedInner(trimmed)
  return innerText ? { kind: "wrapped", innerText } : null
}

// The runs need no surrounding spaces and the inner text may be one character, both of which a fixed regex misses.
function wrappedInner(text) {
  const leading = runLength(LEADING_DIVIDER_RUN, text)
  if (leading < 2) return null

  const body = text.slice(leading).trimStart()
  const trailing = runLength(LEADING_DIVIDER_RUN, reversed(body))
  return trailing >= 2 ? body.slice(0, body.length - trailing).trimEnd() || null : null
}

function runLength(pattern, text) {
  const match = pattern.exec(text)
  return match ? match[0].length : 0
}

function reversed(text) {
  return [ ...text ].reverse().join("")
}

function rebuildComment(comment, innerText) {
  return comment.type === "Line" ? `// ${innerText}` : `/* ${innerText} */`
}

class SourceText {
  #text

  constructor(text) {
    this.#text = text
  }

  removalRangeFor(comment) {
    const [ start, end ] = comment.range
    const lineStart = this.#lineStart(start)
    return this.#isBlankBefore(start, lineStart)
      ? [ lineStart, this.#afterNewline(end) ]
      : [ this.#beforeWhitespace(start), end ]
  }

  #lineStart(position) {
    return this.#text.lastIndexOf("\n", position - 1) + 1
  }

  #isBlankBefore(position, lineStart) {
    return !/\S/u.test(this.#text.slice(lineStart, position))
  }

  #afterNewline(position) {
    const afterCarriage = this.#text[position] === "\r" ? position + 1 : position
    return this.#text[afterCarriage] === "\n" ? afterCarriage + 1 : afterCarriage
  }

  #beforeWhitespace(position) {
    return position > 0 && isLineWhitespace(this.#text[position - 1]) ? this.#beforeWhitespace(position - 1) : position
  }
}

function isLineWhitespace(char) {
  return char === " " || char === "\t"
}
