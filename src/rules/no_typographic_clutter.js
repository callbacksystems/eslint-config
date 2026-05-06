// AI agents (and pasted-from-formatted-text humans) sneak typographic characters into source: smart quotes, en/em
// dashes, ellipses, zero-width spaces. Keep code ASCII-clean: they are invisible noise to the toolchain, break grep,
// and signal sloppy review. Prose and strings get different catalogs, since a string can be text on screen where a
// curly quote is what the author meant, while what nobody can see is a bug in either. Box-drawing and block characters
// belong to `no-section-divider-comments`, and the ASCII two-hyphen dash substitute is banned in comments too.

import bounds from "binary-search-bounds"
import { proseCommentsIn } from "#helpers/source/comments"
import { reportProblems } from "#helpers/eslint/report"
import { byStartPosition } from "#helpers/syntax/sorting"

// Nothing a reader can see: a space that is not one, a hidden hyphen, a joiner, a byte-order mark.
const INVISIBLE = String.raw`\u00A0\u00AD\u200B-\u200D\u202F\u2060\uFEFF`
const INVISIBLE_CLUTTER = new RegExp(`[${INVISIBLE}]`, "gu")
const TYPOGRAPHIC = String.raw`\u2013\u2014\u2026\u2212\u2018-\u201F`
const COMMENT_CLUTTER = new RegExp(`[${TYPOGRAPHIC}]`, "gu")
// Dashes have several plausible ASCII forms, so they stay report-only for a human to map.
const ASCII_EQUIVALENT = {
  "\u{2018}": "'", "\u{2019}": "'",
  "\u{201C}": "\"", "\u{201D}": "\"",
  "\u{2026}": "...",
  "\u{A0}": " ", "\u{202F}": " ",
  "\u{200B}": "", "\u{200C}": "", "\u{200D}": "", "\u{2060}": "", "\u{FEFF}": "",
  "\u{AD}": ""
}

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Disallow typographic clutter: invisible marks anywhere, smart quotes and dashes in prose" },
    schema: [],
    messages: {
      clutter: "Remove typographic character `{{char}}` (U+{{code}}). Use ASCII equivalents.",
      doubleHyphen: "Avoid `--` in comments; use a comma, colon, or parentheses."
    }
  },
  create(context) {
    const { sourceCode } = context

    return {
      Program: () => {
        checkComments(context)
        reportProblems(context, new InvisibleCharacters(sourceCode))
      }
    }
  }
}

// ESLint spells a justification with the same two hyphens this rule bans, so a directive is out of scope.
function checkComments(context) {
  const { sourceCode } = context
  proseCommentsIn(sourceCode).forEach((comment) => {
    reportProblems(context, new ClutterInText(comment, comment.value, sourceCode))
    if (comment.value.includes("--")) context.report({ node: comment, messageId: "doubleHyphen" })
  })
}

class ClutterInText {
  #node
  #text
  #sourceCode

  constructor(node, text, sourceCode) {
    this.#node = node
    this.#text = text
    this.#sourceCode = sourceCode
  }

  get problems() {
    return Array.from(this.#text.matchAll(COMMENT_CLUTTER), (match) => this.#problemFor(match))
  }

  #problemFor(match) {
    const [ char ] = match
    return {
      node: this.#node,
      messageId: "clutter",
      data: { char, code: codePointOf(char) },
      fix: this.#fixFor(char, match.index)
    }
  }

  #fixFor(char, index) {
    const replacement = ASCII_EQUIVALENT[char]
    if (replacement === undefined) return null

    const start = this.#textStart + index
    return (fixer) => fixer.replaceTextRange([ start, start + char.length ], replacement)
  }

  get #textStart() {
    return this.#node.range[0] + this.#nodeSource.indexOf(this.#text)
  }

  get #nodeSource() {
    return this.#sourceCode.text.slice(this.#node.range[0], this.#node.range[1])
  }
}

function codePointOf(char) {
  return char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")
}

class InvisibleCharacters {
  #sourceCode
  #comments

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
    this.#comments = new CommentRanges(sourceCode.getAllComments())
  }

  get problems() {
    return Array.from(this.#sourceCode.text.matchAll(INVISIBLE_CLUTTER), (match) => this.#problemFor(match))
  }

  #problemFor(match) {
    const [ char ] = match
    const start = match.index
    return {
      loc: {
        start: this.#sourceCode.getLocFromIndex(start),
        end: this.#sourceCode.getLocFromIndex(start + char.length)
      },
      messageId: "clutter",
      data: { char, code: codePointOf(char) },
      fix: this.#isSafeAt(start)
        ? (fixer) => fixer.replaceTextRange([ start, start + char.length ], ASCII_EQUIVALENT[char])
        : null
    }
  }

  #isSafeAt(index) {
    return this.#comments.includes(index)
  }
}

class CommentRanges {
  #comments

  constructor(comments) {
    this.#comments = comments
  }

  includes(index) {
    const comment = this.#comments[bounds.le(this.#comments, index, byStartPosition)]
    return Boolean(comment) && index < comment.range[1]
  }
}
