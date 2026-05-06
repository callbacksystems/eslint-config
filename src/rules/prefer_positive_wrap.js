// When a negative guard (`if (!condition) return` or `if (!condition) return V`) is followed by a happy path, wrapping
// it as `if (condition) { ... }` reads more naturally: processing positives is cheaper than negatives. The
// function-length rules already bound how long a happy path can be, so the only real cost of the wrap is the indent
// level it adds: refused when the happy path already nests deeply enough that one more level would breach `max-depth`.
// For value-return guards the value moves into an explicit `else` so the wrap stays a single statement and
// `no-mid-function-returns` is not contradicted.

import { childNodesOf } from "#helpers/ast"
import {
  innerStatementOf, isAnyExit, isFunction, isFunctionExit, isIfWithoutAlternate, onFunctions
} from "#helpers/functions"
import { commentsIn, negated } from "#helpers/source"
import { reportProblem } from "#helpers/report"

const MAX_TOTAL_DEPTH = 3
const NESTING_TYPES = new Set([
  "IfStatement", "ForStatement", "ForInStatement", "ForOfStatement",
  "WhileStatement", "DoWhileStatement", "SwitchStatement", "TryStatement"
])

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Prefer wrapping a happy path positively over a leading negative guard" },
    schema: [],
    messages: { preferPositiveWrap: "Wrap positively: `if (condition) { ... }` instead of a leading negative guard." }
  },
  create(context) {
    return onFunctions((node) => reportProblem(context, new WrappableGuard(node, context.sourceCode)))
  }
}

class WrappableGuard {
  #node
  #sourceCode

  constructor(node, sourceCode) {
    this.#node = node
    this.#sourceCode = sourceCode
  }

  get problem() {
    if (this.#guardIndex === -1) return null
    return { node: this.#guard, messageId: "preferPositiveWrap", fix: this.#fix }
  }

  get #guardIndex() {
    return this.#hasBlockBody ? this.#statements.findIndex((statement, index) => this.#isCandidateAt(index)) : -1
  }

  get #hasBlockBody() {
    return this.#node.body.type === "BlockStatement"
  }

  get #statements() {
    return this.#node.body.body
  }

  #isCandidateAt(index) {
    const guard = this.#statements[index]
    const after = this.#statements.slice(index + 1)
    return isNegativeReturnGuard(guard)
      && after.length > 0
      && maxDepthOf(after) + 1 <= MAX_TOTAL_DEPTH
      && isWrappableTail(after, guardReturnOf(guard))
  }

  get #guard() {
    return this.#statements[this.#guardIndex]
  }

  get #fix() {
    const range = [ this.#guard.range[0], this.#happyPath.at(-1).range[1] ]
    return (fixer) => fixer.replaceTextRange(range, this.#wrappedHappyPath)
  }

  get #happyPath() {
    return this.#statements.slice(this.#guardIndex + 1)
  }

  get #wrappedHappyPath() {
    return `${this.#guardComments}if (${this.#condition}) {\n${this.#indentedBody}\n${this.#indent}}${this.#elseBranch}`
  }

  // A comment on the guard was written about bailing out, which the wrap now says on its own, so it heads the wrap.
  get #guardComments() {
    return commentsIn(this.#sourceCode, this.#guard.range)
      .map((comment) => `${this.#sourceCode.getText(comment)}\n${this.#indent}`)
      .join("")
  }

  get #indent() {
    return " ".repeat(this.#guard.loc.start.column)
  }

  get #condition() {
    return negated(this.#sourceCode, this.#guard.test)
  }

  get #indentedBody() {
    const lines = this.#happyPathText.split("\n")
    return [ `${this.#indent}  ${lines[0]}`, ...lines.slice(1).map(indentDeeper) ].join("\n")
  }

  get #happyPathText() {
    return this.#sourceCode.text.slice(this.#happyPathStart, this.#happyPath.at(-1).range[1])
  }

  // A comment between the two was written about the happy path, so it travels into the wrap.
  get #happyPathStart() {
    const gap = [ this.#guard.range[1], this.#happyPath[0].range[0] ]
    return commentsIn(this.#sourceCode, gap).at(0)?.range[0] ?? this.#happyPath[0].range[0]
  }

  get #elseBranch() {
    const value = guardReturnOf(this.#guard).argument
    return value ? ` else {\n${this.#indent}  return ${this.#sourceCode.getText(value)}\n${this.#indent}}` : ""
  }
}

function isNegativeReturnGuard(node) {
  return isIfWithoutAlternate(node) && isNegated(node.test) && Boolean(guardReturnOf(node))
}

function isNegated(test) {
  return test.type === "UnaryExpression" && test.operator === "!"
}

function guardReturnOf(guard) {
  const inner = innerStatementOf(guard.consequent)
  return inner?.type === "ReturnStatement" ? inner : null
}

// Nested function bodies reset depth, matching `max-depth`.
function maxDepthOf(statements) {
  return Math.max(0, ...statements.map(depthOf))
}

function depthOf(node) {
  return isFunction(node)
    ? 0
    : Number(NESTING_TYPES.has(node.type)) + Math.max(0, ...childNodesOf(node).map(depthOf))
}

// With a value guard the happy path must end in an exit, or the appended trailing return fires on the positive case.
function isWrappableTail(after, guardReturn) {
  return guardReturn.argument
    ? isFunctionExit(after.at(-1)) && after.slice(0, -1).every(isWrappable)
    : after.every(isWrappable)
}

function isWrappable(node) {
  return !containsExit(node)
}

function containsExit(node) {
  return isAnyExit(node) || (Boolean(node) && hasNestedExit(node))
}

function hasNestedExit(node) {
  switch (node.type) {
    case "IfStatement": return containsExit(node.consequent) || containsExit(node.alternate)
    case "BlockStatement": return node.body.some((child) => containsExit(child))
    default: return false
  }
}

function indentDeeper(line) {
  return line === "" ? line : `  ${line}`
}
