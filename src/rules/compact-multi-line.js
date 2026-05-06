// Collapse multi-line constructs to one line when the projected single-line
// version fits within 120 chars. Covers every parens/brackets/braces list:
// object/array literals, destructuring patterns, function parameter lists,
// call/new arguments, named imports/exports.
//
// Skipped when any item is itself multi-line (preserves intentional vertical
// structure in nested objects, multi-line callbacks, etc.) or when the inner
// text contains a comment.

const MAX_WIDTH = 120

const PAREN_TYPES = new Set([
  "ArrowFunctionExpression",
  "CallExpression",
  "FunctionDeclaration",
  "FunctionExpression",
  "NewExpression"
])

const BRACKET_TYPES = new Set([ "ArrayExpression", "ArrayPattern" ])

const bracesFor = (node) => {
  if (PAREN_TYPES.has(node.type)) return { open: "(", close: ")" }
  if (BRACKET_TYPES.has(node.type)) return { open: "[", close: "]" }
  return { open: "{", close: "}" }
}

const isImportSpecifier = (specifier) => specifier.type === "ImportSpecifier"

const ITEMS_GETTER = {
  ArrayExpression: (node) => node.elements.filter(Boolean),
  ArrayPattern: (node) => node.elements.filter(Boolean),
  ArrowFunctionExpression: (node) => node.params,
  CallExpression: (node) => node.arguments,
  ExportNamedDeclaration: (node) => node.specifiers,
  FunctionDeclaration: (node) => node.params,
  FunctionExpression: (node) => node.params,
  ImportDeclaration: (node) => node.specifiers.filter(isImportSpecifier),
  NewExpression: (node) => node.arguments,
  ObjectExpression: (node) => node.properties,
  ObjectPattern: (node) => node.properties
}

const itemsFor = (node) => ITEMS_GETTER[node.type](node)

const findBoundaries = (sourceCode, node, items) => {
  const { open, close } = bracesFor(node)
  const isOpen = (token) => token.value === open
  const isClose = (token) => token.value === close

  const openTok = items.length > 0
    ? sourceCode.getTokenBefore(items[0], isOpen)
    : sourceCode.getFirstToken(node, isOpen)
  if (!openTok) return null

  const closeTok = items.length > 0
    ? sourceCode.getTokenAfter(items.at(-1), isClose)
    : sourceCode.getTokenAfter(openTok, isClose)
  return closeTok ? { open: openTok, close: closeTok } : null
}

const isSingleLine = (item) => item.loc.start.line === item.loc.end.line

const containsComment = (text) => text.includes("//") || text.includes("/*")

const compactWhitespace = (text) => text.replaceAll(/\s+/gu, " ").trim()

const lineFor = (sourceCode, lineNumber) => sourceCode.lines[lineNumber - 1] ?? ""

const projectedLineLength = (sourceCode, boundaries, compactInner) => {
  const { open, close } = boundaries
  const prefix = lineFor(sourceCode, open.loc.start.line).slice(0, open.loc.start.column)
  const suffix = lineFor(sourceCode, close.loc.end.line).slice(close.loc.end.column)
  // +2 accounts for the open/close delimiter itself, which we preserve.
  return prefix.length + compactInner.length + 2 + suffix.length
}

// Object/import/export braces get inner padding (` a, b `) to match
// `@stylistic/object-curly-spacing: always`; parens and brackets do not.
const padInner = (compactInner, openValue) =>
  openValue === "{" && compactInner.length > 0 ? ` ${compactInner} ` : compactInner

const findReplacement = (sourceCode, boundaries) => {
  const { open, close } = boundaries
  if (open.loc.start.line === close.loc.end.line) return null

  const innerRange = [ open.range[1], close.range[0] ]
  const innerText = sourceCode.text.slice(...innerRange)
  if (containsComment(innerText)) return null

  const compactInner = padInner(compactWhitespace(innerText), open.value)
  const projected = projectedLineLength(sourceCode, boundaries, compactInner)
  return projected <= MAX_WIDTH ? { innerRange, compactInner } : null
}

// `export const x = ...` and `import x from "..."` lack their own braces;
// without specifiers there is nothing for this rule to compact.
const SPECIFIER_TYPES = new Set([ "ExportNamedDeclaration", "ImportDeclaration" ])

const isCompactable = (node, items) =>
  (items.length > 0 || !SPECIFIER_TYPES.has(node.type)) && items.every(isSingleLine)

const check = (context, node) => {
  const items = itemsFor(node)
  if (!isCompactable(node, items)) return

  const { sourceCode } = context
  const boundaries = findBoundaries(sourceCode, node, items)
  const replacement = boundaries && findReplacement(sourceCode, boundaries)
  if (!replacement) return

  context.report({
    node,
    loc: { start: boundaries.open.loc.start, end: boundaries.close.loc.end },
    messageId: "compactMultiLine",
    fix: (fixer) => fixer.replaceTextRange(replacement.innerRange, replacement.compactInner)
  })
}

const VISITED_TYPES = [
  "ArrayExpression",
  "ArrayPattern",
  "ArrowFunctionExpression",
  "CallExpression",
  "ExportNamedDeclaration",
  "FunctionDeclaration",
  "FunctionExpression",
  "ImportDeclaration",
  "NewExpression",
  "ObjectExpression",
  "ObjectPattern"
]

export default {
  meta: {
    type: "layout",
    fixable: "code",
    docs: {
      description: "Collapse multi-line lists (params, args, objects, arrays, imports) when they fit on one line"
    },
    schema: [],
    messages: { compactMultiLine: "Collapse to a single line when it fits." }
  },
  create(context) {
    const visit = (node) => check(context, node)
    return Object.fromEntries(VISITED_TYPES.map((type) => [ type, visit ]))
  }
}
