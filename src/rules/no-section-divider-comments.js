// Divider characters: ASCII (`-=*_~#`), em/en-dash, and the full Box Drawing
// (U+2500-U+257F) plus Block Elements (U+2580-U+259F) Unicode blocks.
const dividerCharsOnly = /^[\s\-=*_~#–—─-▟]+$/u
const hasDividerRun = /[-=*_~#–—─-▟]{2,}/u
const wrappedInDividers = /^[-=*_~#–—─-▟]{2,}\s+(\S.*\S)\s+[-=*_~#–—─-▟]{2,}$/u

const classify = (text) => {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (dividerCharsOnly.test(trimmed) && hasDividerRun.test(trimmed)) return { kind: "pure" }

  const match = wrappedInDividers.exec(trimmed)
  return match ? { kind: "wrapped", innerText: match[1] } : null
}

const findLineStart = (text, position) => {
  let cursor = position
  while (cursor > 0 && text[cursor - 1] !== "\n") cursor--
  return cursor
}

const consumeNewline = (text, position) => {
  let cursor = position
  if (text[cursor] === "\r") cursor++
  if (text[cursor] === "\n") cursor++
  return cursor
}

const isLineWhitespace = (char) => char === " " || char === "\t"

const trimLeadingWhitespace = (text, position) => {
  let cursor = position
  while (cursor > 0 && isLineWhitespace(text[cursor - 1])) cursor--
  return cursor
}

const removalRange = (sourceCode, comment) => {
  const { text } = sourceCode
  const [ start, end ] = comment.range
  const lineStart = findLineStart(text, start)
  const isAlone = !/\S/u.test(text.slice(lineStart, start))

  return isAlone
    ? [ lineStart, consumeNewline(text, end) ]
    : [ trimLeadingWhitespace(text, start), end ]
}

const rebuildComment = (comment, innerText) =>
  comment.type === "Line" ? `// ${innerText}` : `/* ${innerText} */`

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

    const reportComment = (comment) => {
      const result = classify(comment.value)
      if (!result) return

      if (result.kind === "pure") {
        context.report({
          node: comment,
          messageId: "pureDivider",
          fix: (fixer) => fixer.removeRange(removalRange(sourceCode, comment))
        })
      } else {
        context.report({
          node: comment,
          messageId: "wrappedDivider",
          fix: (fixer) => fixer.replaceTextRange(comment.range, rebuildComment(comment, result.innerText))
        })
      }
    }

    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) reportComment(comment)
      }
    }
  }
}
