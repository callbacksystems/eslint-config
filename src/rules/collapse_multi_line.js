// Collapse multi-line constructs to one line when the projected single-line version fits within 120 chars. Covers every
// parens/brackets/braces list: object/array literals, destructuring patterns, function parameter lists, call/new
// arguments, named imports/exports.
//
// Skipped when any item is itself multi-line (preserves intentional vertical structure in nested objects, multi-line
// callbacks, etc.) or when a comment sits between the delimiters.
//
// The collapsed text is rebuilt from the tokens, never by compacting the raw source: only the gaps between tokens are
// rewritten, so significant whitespace inside a string, template, or regex is preserved.

import { isSingleLine, onTypes } from "#helpers/ast"
import { reportProblem } from "#helpers/report"

const PAREN_TYPES = new Set([
  "ArrowFunctionExpression",
  "CallExpression",
  "FunctionDeclaration",
  "FunctionExpression",
  "NewExpression"
])
const BRACKET_TYPES = new Set([ "ArrayExpression", "ArrayPattern" ])
const ITEMS_GETTER = {
  ArrayExpression: (node) => node.elements.filter(Boolean),
  ArrayPattern: (node) => node.elements.filter(Boolean),
  ArrowFunctionExpression: (node) => node.params,
  CallExpression: (node) => node.arguments,
  ExportNamedDeclaration: (node) => node.specifiers,
  FunctionDeclaration: (node) => node.params,
  FunctionExpression: (node) => node.params,
  ImportDeclaration: (node) => node.specifiers.filter((specifier) => specifier.type === "ImportSpecifier"),
  NewExpression: (node) => node.arguments,
  ObjectExpression: (node) => node.properties,
  ObjectPattern: (node) => node.properties
}
// `export const x = ...` and `import x from "..."` lack their own braces; without specifiers there is nothing for this
// rule to compact.
const SPECIFIER_TYPES = new Set([ "ExportNamedDeclaration", "ImportDeclaration" ])
const COMMENT_TYPES = new Set([ "Line", "Block" ])
const VISITED_TYPES = Object.keys(ITEMS_GETTER)

export default {
  meta: {
    type: "layout",
    fixable: "code",
    docs: {
      description: "Collapse multi-line lists (params, args, objects, arrays, imports) when they fit on one line"
    },
    schema: [
      { type: "object", properties: { maxLength: { type: "integer", minimum: 1 } }, additionalProperties: false }
    ],
    defaultOptions: [ { maxLength: 120 } ],
    messages: { collapseMultiLine: "Collapse to a single line when it fits." }
  },
  create(context) {
    const { maxLength } = context.options[0]
    return onTypes(VISITED_TYPES, (node) => reportProblem(context, new Compaction(node, context.sourceCode, maxLength)))
  }
}

class Compaction {
  #node
  #sourceCode
  #maxLength
  #cachedItems
  #cachedOpen
  #cachedClose
  #cachedTokens

  constructor(node, sourceCode, maxLength) {
    this.#node = node
    this.#sourceCode = sourceCode
    this.#maxLength = maxLength
  }

  get problem() {
    return this.#fits
      ? {
        node: this.#node,
        loc: { start: this.#open.loc.start, end: this.#close.loc.end },
        messageId: "collapseMultiLine",
        fix: (fixer) => fixer.replaceTextRange(this.#innerRange, this.#compactInner)
      }
      : null
  }

  get #fits() {
    return this.#isCollapsible && this.#projectedLength <= this.#maxLength
  }

  get #isCollapsible() {
    return this.#isCompactable && this.#isMultiLine && !this.#holdsComment
  }

  get #isCompactable() {
    return (this.#items.length > 0 || !SPECIFIER_TYPES.has(this.#node.type)) && this.#items.every(isSingleLine)
  }

  get #items() {
    return this.#cachedItems ??= ITEMS_GETTER[this.#node.type](this.#node)
  }

  get #isMultiLine() {
    return Boolean(this.#close) && this.#open.loc.start.line !== this.#close.loc.end.line
  }

  get #close() {
    return this.#cachedClose ??= this.#open && this.#owned(this.#items.length > 0
      ? this.#sourceCode.getTokenAfter(this.#items.at(-1), (token) => token.value === this.#braces.close)
      : this.#sourceCode.getTokenAfter(this.#open, (token) => token.value === this.#braces.close))
  }

  get #open() {
    return this.#cachedOpen ??= this.#owned(this.#items.length > 0
      ? this.#sourceCode.getTokenBefore(this.#items[0], (token) => token.value === this.#braces.open)
      : this.#sourceCode.getFirstToken(this.#node, (token) => token.value === this.#braces.open))
  }

  // `entry => {}` has no parentheses of its own, so the search for one walks out and finds the call's.
  #owned(token) {
    return token && this.#holds(token) ? token : null
  }

  #holds(token) {
    return token.range[0] >= this.#node.range[0] && token.range[1] <= this.#node.range[1]
  }

  get #braces() {
    return bracesFor(this.#node)
  }

  get #holdsComment() {
    return this.#innerTokens.some((token) => COMMENT_TYPES.has(token.type))
  }

  // A comment between the delimiters blocks the collapse, and can only be found by asking for it.
  get #innerTokens() {
    return this.#cachedTokens ??= this.#sourceCode
      .getTokensBetween(this.#open, this.#close, { includeComments: true })
  }

  get #projectedLength() {
    // +2 accounts for the open/close delimiter itself, which we preserve.
    return this.#prefix.length + this.#compactInner.length + 2 + this.#suffix.length
  }

  get #prefix() {
    return lineFor(this.#sourceCode, this.#open.loc.start.line).slice(0, this.#open.loc.start.column)
  }

  get #compactInner() {
    return padInner(joined(this.#sourceCode, this.#innerTokens), this.#open.value)
  }

  get #suffix() {
    return lineFor(this.#sourceCode, this.#close.loc.end.line).slice(this.#close.loc.end.column)
  }

  get #innerRange() {
    return [ this.#open.range[1], this.#close.range[0] ]
  }
}

function bracesFor(node) {
  if (PAREN_TYPES.has(node.type)) return { open: "(", close: ")" }
  if (BRACKET_TYPES.has(node.type)) return { open: "[", close: "]" }
  return { open: "{", close: "}" }
}

function lineFor(sourceCode, lineNumber) {
  return sourceCode.lines[lineNumber - 1] ?? ""
}

// Object/import/export braces get inner padding (` a, b `) to match `@stylistic/object-curly-spacing: always`; parens
// and brackets do not.
function padInner(compactInner, openValue) {
  return openValue === "{" && compactInner.length > 0 ? ` ${compactInner} ` : compactInner
}

function joined(sourceCode, tokens) {
  return tokens.reduce(
    (text, token, index) => text + separatorBefore(sourceCode, tokens[index - 1], token) + sourceCode.getText(token),
    ""
  )
}

// Tokens that were already touching stay touching (`-1`, `a:`); anything the source separated collapses to one space.
function separatorBefore(sourceCode, previous, token) {
  if (previous) {
    return previous.range[1] === token.range[0] ? "" : " "
  } else {
    return ""
  }
}
