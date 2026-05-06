const containsComment = (text) => text.includes("//") || text.includes("/*")

const compactWhitespace = (text) => text.replaceAll(/\s+/gu, " ").trim()

const lineFor = (sourceCode, lineNumber) => sourceCode.lines[lineNumber - 1] ?? ""

const projectedLineLength = (sourceCode, node, compactText) => {
  const { start } = node.loc
  const { end } = node.loc
  const prefix = lineFor(sourceCode, start.line).slice(0, start.column)
  const suffix = lineFor(sourceCode, end.line).slice(end.column)
  return prefix.length + compactText.length + suffix.length
}

const findCompactReplacement = (sourceCode, node) => {
  if (node.loc.start.line === node.loc.end.line) return null

  const nodeText = sourceCode.getText(node)
  if (containsComment(nodeText)) return null

  const compactText = compactWhitespace(nodeText)
  const projected = projectedLineLength(sourceCode, node, compactText)
  return compactText !== nodeText && projected <= 120 ? compactText : null
}

export default {
  meta: {
    type: "layout",
    fixable: "code",
    docs: {
      description: "Prefer compact single-line object destructuring when it fits on the line"
    },
    schema: [],
    messages: {
      compactObjectPattern: "Collapse this object destructuring pattern to a single line when it fits."
    }
  },
  create(context) {
    const { sourceCode } = context

    return {
      ObjectPattern(node) {
        const compactText = findCompactReplacement(sourceCode, node)
        if (!compactText) return

        context.report({
          node,
          messageId: "compactObjectPattern",
          fix: (fixer) => fixer.replaceText(node, compactText)
        })
      }
    }
  }
}
