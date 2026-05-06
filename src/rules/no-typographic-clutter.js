// AI agents (and pasted-from-formatted-text humans) sneak typographic
// characters into source: smart quotes, en/em dashes, ellipses, arrows,
// bullets, zero-width spaces. Keep code ASCII-clean: these chars are
// invisible noise to the toolchain, break grep, and signal sloppy review.
//
// Banned ranges:
//   U+00A0  no-break space          U+00AB U+00BB  guillemets
//   U+00AD  soft hyphen (invisible) U+200B-U+200D  zero-width space/joiner
//   U+2013  en-dash                 U+2014         em-dash
//   U+2018-U+201F  smart quotes     U+2022 U+2023 U+2043 U+25E6  bullets
//   U+2026  ellipsis                U+2039 U+203A  single guillemets
//   U+202F  narrow no-break space   U+2060         word joiner
//   U+2190-U+21FF  arrows block     U+2212         minus sign
//   U+2713 U+2717  check / x marks  U+FEFF         BOM
//
// Decorative line-drawing characters (U+2500-U+259F box drawing / block
// elements) are handled by `no-section-divider-comments`.

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

const checkText = (context, node, text) => {
  const match = CLUTTER.exec(text)
  if (match) {
    const code = match[0].codePointAt(0).toString(16).toUpperCase().padStart(4, "0")
    context.report({ node, messageId: "clutter", data: { char: match[0], code } })
  }
}

const checkComments = (context, sourceCode) => {
  for (const comment of sourceCode.getAllComments()) {
    checkText(context, comment, comment.value)
  }
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow typographic clutter (smart quotes, en/em dash, arrows, bullets, zero-width)" },
    schema: [],
    messages: { clutter: "Remove typographic character `{{char}}` (U+{{code}}). Use ASCII equivalents." }
  },
  create(context) {
    const { sourceCode } = context

    return {
      Program: () => checkComments(context, sourceCode),
      Literal: (node) => {
        if (typeof node.value === "string") checkText(context, node, node.raw)
      },
      TemplateElement: (node) => checkText(context, node, node.value.raw)
    }
  }
}
