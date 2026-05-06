// Collapse multi-line constructs to one line when the projected single-line version fits within 120 chars. Covers every
// parens/brackets/braces list: object/array literals, destructuring patterns, function parameter lists, call/new
// arguments, named imports/exports.
//
// Skipped when any item is itself multi-line (preserves intentional vertical structure in nested objects, multi-line
// callbacks, etc.) or when a comment sits between the delimiters.
//
// The collapsed text is rebuilt from the tokens, never by compacting the raw source: only the gaps between tokens are
// rewritten, so significant whitespace inside a string, template, or regex is preserved.

import { isSingleLine, onTypes } from "#helpers/syntax/ast"
import { isFunction } from "#helpers/syntax/functions"
import { isWithin } from "#helpers/syntax/ranges"
import { reportProblem } from "#helpers/eslint/report"

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
  ExportNamedDeclaration: (node) => node.specifiers.filter((specifier) => specifier.type === "ExportSpecifier"),
  FunctionDeclaration: (node) => node.params,
  FunctionExpression: (node) => node.params,
  ImportDeclaration: (node) => node.specifiers.filter((specifier) => specifier.type === "ImportSpecifier"),
  NewExpression: (node) => node.arguments,
  ObjectExpression: (node) => node.properties,
  ObjectPattern: (node) => node.properties
}
// `export const x` and `import x from` have no braces of their own, so without specifiers there is nothing to compact.
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
    return !isSingleLine(this.#node) && this.#isCompactable && this.#isMultiLine && !this.#holdsComment
  }

  get #isCompactable() {
    return (this.#items.length > 0 || !SPECIFIER_TYPES.has(this.#node.type))
      && this.#items.every(isSingleLine)
      && this.#hasOwnedDelimiters
  }

  get #items() {
    return this.#cachedItems ??= ITEMS_GETTER[this.#node.type](this.#node)
  }

  // `new (Expression)` may omit its argument list. Its final parens then group the callee rather than delimit
  // arguments, and compacting between them could rewrite arbitrary code inside that expression.
  get #hasOwnedDelimiters() {
    return Boolean(this.#open && this.#close)
      && (this.#node.type !== "NewExpression" || this.#open.range[0] >= this.#node.callee.range[1])
  }

  get #open() {
    return this.#cachedOpen ??= this.#matchingOpen
  }

  get #matchingOpen() {
    let depth = 0
    for (let token = this.#close; token && this.#holds(token); token = this.#sourceCode.getTokenBefore(token)) {
      if (token.value === this.#braces.close) depth += 1
      if (token.value === this.#braces.open && (depth -= 1) === 0) return token
    }
    return null
  }

  get #close() {
    return this.#cachedClose ??= this.#owned(this.#closingToken)
  }

  // `entry => {}` has no parentheses of its own, so the search for one walks out and finds the call's.
  #owned(token) {
    return token && this.#holds(token) ? token : null
  }

  #holds(token) {
    return isWithin(token, this.#node.range)
  }

  get #closingToken() {
    if (isFunction(this.#node)) {
      return this.#sourceCode.getTokenBefore(this.#node.body, (token) => token.value === this.#braces.close)
    }
    if (SPECIFIER_TYPES.has(this.#node.type) && this.#items.length > 0) {
      return this.#sourceCode.getTokenAfter(this.#items.at(-1), (token) => token.value === this.#braces.close)
    }
    return this.#sourceCode.getLastToken(this.#node, (token) => token.value === this.#braces.close)
  }

  get #braces() {
    return bracesFor(this.#node)
  }

  get #isMultiLine() {
    return Boolean(this.#close) && this.#open.loc.start.line !== this.#close.loc.end.line
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
    return this.#prefix.length + this.#compactInner.length + this.#delimitersLength + this.#suffix.length
  }

  get #prefix() {
    return lineFor(this.#sourceCode, this.#open.loc.start.line).slice(0, this.#open.loc.start.column)
  }

  get #compactInner() {
    return padInner(joined(this.#sourceCode, this.#innerTokens), this.#open.value)
  }

  get #delimitersLength() {
    return this.#open.value.length + this.#close.value.length
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
  return sourceCode.lines[lineNumber - 1]
}

// Braces get inner padding to match `@stylistic/object-curly-spacing: always`, while parens and brackets do not.
function padInner(compactInner, openValue) {
  return openValue === "{" && compactInner.length > 0 ? ` ${compactInner} ` : compactInner
}

function joined(sourceCode, tokens) {
  return tokens.reduce(
    (text, token, index) => text + separatorBefore(sourceCode, tokens[index - 1], token) + sourceCode.getText(token),
    ""
  )
}

function separatorBefore(sourceCode, previous, token) {
  if (previous) {
    return previous.range[1] === token.range[0] ? "" : " "
  } else {
    return ""
  }
}
