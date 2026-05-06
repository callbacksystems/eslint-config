// AI agents (and pasted-from-formatted-text humans) sneak typographic characters into source: smart quotes, en/em
// dashes, ellipses, arrows, bullets, zero-width spaces. Keep code ASCII-clean: they are invisible noise to the
// toolchain, break grep, and signal sloppy review. The CLUTTER regex below is the exact set; box-drawing and block
// characters belong to `no-section-divider-comments`, and the ASCII two-hyphen em-dash substitute is banned in comments
// too.

import { reportProblem } from "#helpers/report"

const CLUTTER = new RegExp(
  String.raw`[\u00A0\u00AB\u00AD\u00BB` +
  String.raw`\u200B-\u200D` +
  String.raw`\u2013\u2014` +
  String.raw`\u2018-\u201F` +
  String.raw`\u2022\u2023\u2026\u2039\u203A\u2043` +
  String.raw`\u202F\u2060` +
  String.raw`\u2190-\u21FF` +
  String.raw`\u2212\u25E6\u2713\u2717\uFEFF]`,
  "u"
)
// Only characters with one unambiguous ASCII spelling that preserves meaning are auto-fixed. Dashes, arrows, bullets,
// guillemets and check marks have several plausible ASCII forms (or none), so they stay report-only for a human to map.
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
    docs: { description: "Disallow typographic clutter (smart quotes, en/em dash, arrows, bullets, zero-width)" },
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

function checkComments(context) {
  const { sourceCode } = context
  sourceCode.getAllComments().forEach((comment) => {
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

  #collidesWithDelimiter(replacement) {
    return this.#node.type === "Literal" && this.#node.raw[0] === replacement
  }

  get #clutterChar() {
    return CLUTTER.exec(this.#text)?.[0] ?? null
  }

  get #fix() {
    const char = this.#clutterChar
    const replacement = ASCII_EQUIVALENT[char]
    if (replacement === undefined || this.#collidesWithDelimiter(replacement)) return null

    const start = this.#node.range[0] + this.#nodeSource.indexOf(char)
    return (fixer) => fixer.replaceTextRange([ start, start + char.length ], replacement)
  }

  get #nodeSource() {
    return this.#sourceCode.text.slice(this.#node.range[0], this.#node.range[1])
  }
}

function codePointOf(char) {
  return char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")
}
