// Mirror of `@stylistic/padded-blocks: never` for the brace pairs that rule doesn't cover: imports, named exports,
// object literals, and destructuring. Blank lines BETWEEN entries stay fine; only the gap right after `{` and right
// before `}` is banned.

import { onTypes } from "#helpers/syntax/ast"
import { collapseBlankLines, hasBlankBetween } from "#helpers/source/source"
import { reportProblems } from "#helpers/eslint/report"

const OBJECT_TYPES = new Set([ "ObjectExpression", "ObjectPattern" ])

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
    return onTypes(
      [ "ImportDeclaration", "ExportNamedDeclaration", "ObjectExpression", "ObjectPattern" ],
      (node) => reportProblems(context, new Braces(node, context.sourceCode))
    )
  }
}

class Braces {
  #node
  #sourceCode

  constructor(node, sourceCode) {
    this.#node = node
    this.#sourceCode = sourceCode
  }

  get problems() {
    const { open, close } = this.#braces
    if (!open || !close) return []

    const { first, last } = this.#innerOf(open, close)
    if (!first || first === close) return []

    return [
      ...this.#gapProblem("afterOpen", open, [ open, first ]),
      ...this.#gapProblem("beforeClose", close, [ last, close ])
    ]
  }

  get #braces() {
    if (OBJECT_TYPES.has(this.#node.type)) return this.#objectBraces

    const tokens = this.#moduleTokens
    return { open: tokens.find(isOpen), close: tokens.findLast(isClose) }
  }

  get #objectBraces() {
    return { open: this.#sourceCode.getFirstToken(this.#node), close: this.#sourceCode.getLastToken(this.#node) }
  }

  get #moduleTokens() {
    if (this.#node.type === "ExportNamedDeclaration" && this.#node.declaration) return []

    const tokens = this.#sourceCode.getTokens(this.#node)
    return this.#node.source
      ? tokens.filter((token) => token.range[1] <= this.#node.source.range[0])
      : tokens
  }

  #innerOf(open, close) {
    return {
      first: this.#sourceCode.getTokenAfter(open, { includeComments: true }),
      last: this.#sourceCode.getTokenBefore(close, { includeComments: true })
    }
  }

  #gapProblem(messageId, node, gap) {
    return hasBlankBetween(gap[0], gap[1])
      ? [ { node, messageId, fix: (fixer) => this.#collapseFix(fixer, gap) } ]
      : []
  }

  #collapseFix(fixer, gap) {
    const range = [ gap[0].range[1], gap[1].range[0] ]
    return fixer.replaceTextRange(range, collapseBlankLines(this.#sourceCode.text.slice(...range)))
  }
}

function isOpen(token) {
  return token.value === "{"
}

function isClose(token) {
  return token.value === "}"
}
