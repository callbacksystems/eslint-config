// Each node travels with its own-line leading comments and its line indent, and the blank-line gaps between slots are
// preserved, so reordering never detaches a comment or reflows the spacing between members.

import { isOnOwnLine } from "#helpers/source"

export function reorderFix(sourceCode, { from, to }) {
  return new Blocks(sourceCode).reorderFix(from, to)
}

export function blockStartOf(sourceCode, node) {
  const anchor = sourceCode.getCommentsBefore(node).find((comment) => isOnOwnLine(sourceCode, comment)) ?? node
  return anchor.range[0] - anchor.loc.start.column
}

// A comment on the node's own last line explains this node, so it moves with it.
export function blockEndOf(sourceCode, node) {
  const anchor = sourceCode.getCommentsAfter(node).find(startingOnLine(node.loc.end.line)) ?? node
  return anchor.range[1]
}

export function blockTextOf(sourceCode, node) {
  return sourceCode.text.slice(blockStartOf(sourceCode, node), blockEndOf(sourceCode, node))
}

export function firstDivergenceBetween(actual, canonical) {
  const index = actual.findIndex((name, position) => name !== canonical[position])
  return index === -1 ? null : { expected: canonical[index], actual: actual[index] }
}

class Blocks {
  #sourceCode

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  reorderFix(nodes, orderedNodes) {
    const starts = nodes.map((node) => blockStartOf(this.#sourceCode, node))
    const gaps = nodes.slice(0, -1).map((node, index) =>
      this.#sourceCode.text.slice(blockEndOf(this.#sourceCode, node), starts[index + 1]))
    const text = orderedNodes
      .map((node) => blockTextOf(this.#sourceCode, node))
      .reduce((result, block, index) => result + block + (gaps[index] ?? ""), "")
    return (fixer) => fixer.replaceTextRange([ starts[0], blockEndOf(this.#sourceCode, nodes.at(-1)) ], text)
  }
}

function startingOnLine(line) {
  return (comment) => comment.loc.start.line === line
}
