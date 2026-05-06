// AI agents (and pasted-from-formatted-text humans) sneak typographic characters into source: smart quotes, en/em
// dashes, ellipses, zero-width spaces. Keep code ASCII-clean: they are invisible noise to the toolchain, break grep,
// and signal sloppy review. Prose and strings get different catalogs, since a string can be text on screen where a
// curly quote is what the author meant, while what nobody can see is a bug in either. Box-drawing and block characters
// belong to `no-section-divider-comments`, and the ASCII two-hyphen dash substitute is banned in comments too.

import { proseCommentsIn } from "#helpers/comments"
import { reportProblem } from "#helpers/report"

// Nothing a reader can see: a space that is not one, a hidden hyphen, a joiner, a byte-order mark.
const INVISIBLE = String.raw`\u00A0\u00AD\u202F\u2060\uFEFF`
const COMMENT_TYPES = new Set([ "Line", "Block" ])
const STRING_CLUTTER = new RegExp(`[${INVISIBLE}]`, "u")
const TYPOGRAPHIC = String.raw`\u200B-\u200D\u2013\u2014\u2026\u2212\u2018-\u201F`
const COMMENT_CLUTTER = new RegExp(`[${INVISIBLE}${TYPOGRAPHIC}]`, "u")
// Only characters with one unambiguous ASCII spelling that preserves meaning are auto-fixed. Dashes have several
// plausible ASCII forms, so they stay report-only for a human to map.
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
      Program: () => checkComments(context),
      Literal: (node) => {
        if (typeof node.value === "string") reportProblem(context, new ClutterInText(node, node.raw, sourceCode))
      },
      TemplateElement: (node) => reportProblem(context, new ClutterInText(node, node.value.raw, sourceCode))
    }
  }
}

// ESLint spells a justification with the same two hyphens this rule bans, so a directive is out of scope.
function checkComments(context) {
  const { sourceCode } = context
  proseCommentsIn(sourceCode).forEach((comment) => {
    reportProblem(context, new ClutterInText(comment, comment.value, sourceCode))
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

  get problem() {
    const char = this.#clutterChar
    if (char) return { node: this.#node, messageId: "clutter", data: { char, code: codePointOf(char) }, fix: this.#fix }
    return null
  }

  get #clutterChar() {
    return this.#catalog.exec(this.#text)?.[0] ?? null
  }

  get #catalog() {
    return COMMENT_TYPES.has(this.#node.type) ? COMMENT_CLUTTER : STRING_CLUTTER
  }

  get #fix() {
    const char = this.#clutterChar
    const replacement = ASCII_EQUIVALENT[char]
    if (replacement === undefined || this.#collidesWithDelimiter(replacement)) return null

    const start = this.#node.range[0] + this.#nodeSource.indexOf(char)
    return (fixer) => fixer.replaceTextRange([ start, start + char.length ], replacement)
  }

  #collidesWithDelimiter(replacement) {
    return this.#node.type === "Literal" && this.#node.raw[0] === replacement
  }

  get #nodeSource() {
    return this.#sourceCode.text.slice(this.#node.range[0], this.#node.range[1])
  }
}

function codePointOf(char) {
  return char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")
}
