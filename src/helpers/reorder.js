// Rewriting a run of sibling nodes (class members, top-level statements) into a
// new order. Each node travels with its own-line leading comments and its line
// indent, and the blank-line gaps between slots are preserved, so reordering
// never detaches a comment or reflows the spacing between members.

import { isOnOwnLine } from "#helpers/source"

export function reorderFix(sourceCode, { from, to }) {
  return new Blocks(sourceCode).reorderFix(from, to)
}

// The offset where a node's block begins: the start of its first own-line leading
// comment, or the node, backed up to the line indent so the block keeps it.
export function blockStartOf(sourceCode, node) {
  const anchor = sourceCode.getCommentsBefore(node).find((comment) => isOnOwnLine(sourceCode, comment)) ?? node
  return anchor.range[0] - anchor.loc.start.column
}

// The source text of a node together with its own-line leading comments and line
// indent: the unit that travels as a block when reordering siblings.
export function blockTextOf(sourceCode, node) {
  return sourceCode.text.slice(blockStartOf(sourceCode, node), node.range[1])
}

class Blocks {
  #sourceCode

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  reorderFix(nodes, orderedNodes) {
    const starts = nodes.map((node) => blockStartOf(this.#sourceCode, node))
    const gaps = nodes.slice(0, -1).map((node, index) => this.#sourceCode.text.slice(node.range[1], starts[index + 1]))
    const text = orderedNodes
      .map((node) => blockTextOf(this.#sourceCode, node))
      .reduce((result, block, index) => result + block + (gaps[index] ?? ""), "")
    return (fixer) => fixer.replaceTextRange([ starts[0], nodes.at(-1).range[1] ], text)
  }
}
