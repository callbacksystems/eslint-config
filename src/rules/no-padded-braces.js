// Mirror of `@stylistic/padded-blocks: never` for the brace pairs that rule
// doesn't cover: imports, named exports, object literals, and destructuring.
// Blank lines BETWEEN entries stay fine; only the gap right after `{` and
// right before `}` is banned.

const TARGETS = new Set([ "ImportDeclaration", "ExportNamedDeclaration", "ObjectExpression", "ObjectPattern" ])

const isOpen = (token) => token.value === "{"
const isClose = (token) => token.value === "}"

const collapseBlankLines = (text) => text.replaceAll(/\n[ \t]*\n/gu, "\n")

const reportAfterOpen = (context, openBrace, firstInner) => {
  const { sourceCode } = context
  context.report({
    node: openBrace,
    messageId: "afterOpen",
    fix: (fixer) => {
      const range = [ openBrace.range[1], firstInner.range[0] ]
      const collapsed = collapseBlankLines(sourceCode.text.slice(...range))
      return fixer.replaceTextRange(range, collapsed)
    }
  })
}

const reportBeforeClose = (context, lastInner, closeBrace) => {
  const { sourceCode } = context
  context.report({
    node: closeBrace,
    messageId: "beforeClose",
    fix: (fixer) => {
      const range = [ lastInner.range[1], closeBrace.range[0] ]
      const collapsed = collapseBlankLines(sourceCode.text.slice(...range))
      return fixer.replaceTextRange(range, collapsed)
    }
  })
}

const findBraces = (sourceCode, node) => ({
  open: sourceCode.getFirstToken(node, isOpen),
  close: sourceCode.getLastToken(node, isClose)
})

const findInner = (sourceCode, open, close) => ({
  first: sourceCode.getTokenAfter(open, { includeComments: true }),
  last: sourceCode.getTokenBefore(close, { includeComments: true })
})

const hasBlankBetween = (earlier, later) => later.loc.start.line - earlier.loc.end.line > 1

const check = (context, node) => {
  const { sourceCode } = context
  const { open, close } = findBraces(sourceCode, node)
  if (!open || !close) return

  const { first, last } = findInner(sourceCode, open, close)
  if (!first || first === close) return

  if (hasBlankBetween(open, first)) reportAfterOpen(context, open, first)
  if (hasBlankBetween(last, close)) reportBeforeClose(context, last, close)
}

export default {
  meta: {
    type: "layout",
    fixable: "whitespace",
    docs: {
      description: "Disallow blank lines after `{` or before `}` in imports, exports, objects, and destructuring"
    },
    schema: [],
    messages: { afterOpen: "Remove blank line after `{`.", beforeClose: "Remove blank line before `}`." }
  },
  create(context) {
    const visitor = (node) => check(context, node)
    return Object.fromEntries([ ...TARGETS ].map((type) => [ type, visitor ]))
  }
}
