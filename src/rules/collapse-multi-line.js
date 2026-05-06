// Collapse multi-line constructs to one line when the projected single-line
// version fits within 120 chars. Covers every parens/brackets/braces list:
// object/array literals, destructuring patterns, function parameter lists,
// call/new arguments, named imports/exports.
//
// Skipped when any item is itself multi-line (preserves intentional vertical
// structure in nested objects, multi-line callbacks, etc.) or when the inner
// text contains a comment.

import { isSingleLine, onTypes } from "#helpers/ast"
import { reportProblem } from "#helpers/report"
import { compactWhitespace, containsComment } from "#helpers/source"

const DEFAULT_MAX_LENGTH = 120
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
// `export const x = ...` and `import x from "..."` lack their own braces;
// without specifiers there is nothing for this rule to compact.
const SPECIFIER_TYPES = new Set([ "ExportNamedDeclaration", "ImportDeclaration" ])
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
    messages: { collapseMultiLine: "Collapse to a single line when it fits." }
  },
  create(context) {
    const maxLength = context.options[0]?.maxLength ?? DEFAULT_MAX_LENGTH
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
    return this.#isCompactable && this.#isMultiLine && !containsComment(this.#innerText)
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
    return this.#cachedClose ??= this.#open && (this.#items.length > 0
      ? this.#sourceCode.getTokenAfter(this.#items.at(-1), (token) => token.value === this.#braces.close)
      : this.#sourceCode.getTokenAfter(this.#open, (token) => token.value === this.#braces.close))
  }

  get #open() {
    return this.#cachedOpen ??= this.#items.length > 0
      ? this.#sourceCode.getTokenBefore(this.#items[0], (token) => token.value === this.#braces.open)
      : this.#sourceCode.getFirstToken(this.#node, (token) => token.value === this.#braces.open)
  }

  get #braces() {
    return bracesFor(this.#node)
  }

  get #innerText() {
    return this.#sourceCode.text.slice(...this.#innerRange)
  }

  get #innerRange() {
    return [ this.#open.range[1], this.#close.range[0] ]
  }

  get #projectedLength() {
    // +2 accounts for the open/close delimiter itself, which we preserve.
    return this.#prefix.length + this.#compactInner.length + 2 + this.#suffix.length
  }

  get #prefix() {
    return lineFor(this.#sourceCode, this.#open.loc.start.line).slice(0, this.#open.loc.start.column)
  }

  get #compactInner() {
    return padInner(compactWhitespace(this.#innerText), this.#open.value)
  }

  get #suffix() {
    return lineFor(this.#sourceCode, this.#close.loc.end.line).slice(this.#close.loc.end.column)
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

// Object/import/export braces get inner padding (` a, b `) to match
// `@stylistic/object-curly-spacing: always`; parens and brackets do not.
function padInner(compactInner, openValue) {
  return openValue === "{" && compactInner.length > 0 ? ` ${compactInner} ` : compactInner
}
