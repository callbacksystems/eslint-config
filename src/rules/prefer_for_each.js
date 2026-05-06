// `for...of` doing pure side-effect iteration reads better as `.forEach()`: declarative, no loop scaffolding. Skipped
// when the body needs `break`, `continue`, `return`, `await`, or `yield` (which `forEach` cannot express), for `for
// await...of`, and for string literals (which have no `.forEach`). Conservative on purpose: control flow inside nested
// loops still skips the outer loop, so it never suggests an impossible conversion. A loop filling an accumulator
// declared empty above it belongs to `no-manual-accumulation`, which points at `map`, where `forEach` would be a half
// step.
//
// The iterable additionally needs a demonstrably compatible `forEach`: an array, or a Set whose callback's first
// argument matches the value its iterator yields. A generator has no `forEach`, and Map's yields `(value, key)` rather
// than the `[key, value]` entry its iterator yields. Array autofix narrows further to a fresh dense array, where sparse
// slots or mutation through another reference cannot change the result; a directly constructed Set is already fresh.

import { Accumulation } from "#helpers/arrays/accumulation"
import { ForEachConversionFacts } from "#helpers/arrays/for_each_conversion_facts"
import { ForEachFixPlan } from "#helpers/arrays/for_each_fix_plan"
import { ForEachFixSafety } from "#helpers/arrays/for_each_fix_safety"
import { ForEachIterable } from "#helpers/arrays/for_each_iterable"
import { hasAdjacentToolDirectiveBefore } from "#helpers/source/comment_directives"
import { PreviousStatements } from "#helpers/syntax/previous_statements"
import { isWithin } from "#helpers/syntax/ranges"
import { closesStatement, commentsIn, continuesStatement } from "#helpers/source/source"
import { reportProblems } from "#helpers/eslint/report"

const EXPRESSION_BODY_PARENS = new Set([ "ObjectExpression", "SequenceExpression" ])
const FRESH_BINDING_KINDS = new Set([ "const", "let" ])

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Prefer `.forEach()` over `for...of` for pure compatible collection iteration" },
    schema: [],
    messages: {
      preferForEach: "Prefer `.forEach()` over `for...of` for pure iteration (no break/continue/return/await)."
    }
  },
  create(context) {
    const facts = new ForEachConversionFacts()
    const previousStatements = new PreviousStatements()
    const loops = new Loops(context.sourceCode, previousStatements)
    return {
      "Program:exit": () => reportProblems(context, loops),
      FunctionDeclaration: (node) => facts.enterFunction(node),
      FunctionExpression: () => facts.enterFunction(),
      ArrowFunctionExpression: () => facts.enterFunction(),
      "FunctionDeclaration:exit": () => facts.leaveScope(),
      "FunctionExpression:exit": () => facts.leaveScope(),
      "ArrowFunctionExpression:exit": () => facts.leaveScope(),
      StaticBlock: () => facts.enterScope(),
      "StaticBlock:exit": () => facts.leaveScope(),
      AwaitExpression: (node) => facts.addEscape(node),
      BreakStatement: (node) => facts.addEscape(node),
      ContinueStatement: (node) => facts.addEscape(node),
      ReturnStatement: (node) => facts.addEscape(node),
      YieldExpression: (node) => facts.addEscape(node),
      VariableDeclaration: (node) => facts.addVariableDeclaration(node),
      ForOfStatement: (node) => {
        facts.addAwaitLoop(node)
        loops.enter(node)
      },
      "ForOfStatement:exit": (node) => loops.leave(node, facts.current)
    }
  }
}

class Loops {
  #sourceCode
  #previousStatements
  #open = []
  #values = []

  constructor(sourceCode, previousStatements) {
    this.#sourceCode = sourceCode
    this.#previousStatements = previousStatements
  }

  get problems() {
    return new ForEachFixPlan(this.#values, this.#sourceCode).problems
  }

  enter(node) {
    this.#open.push(node)
  }

  leave(node, facts) {
    this.#open.pop()
    this.#values.push(new Loop(node, {
      facts,
      sourceCode: this.#sourceCode,
      previousStatements: this.#previousStatements,
      parent: this.#open.at(-1) ?? null,
      depth: this.#open.length
    }))
  }
}

class Loop {
  #sourceCode
  #facts
  #previousStatements
  #depth
  #cachedEdits
  #cachedIterable
  #cachedIsConvertible

  constructor(node, { sourceCode, facts, previousStatements, parent, depth }) {
    this.node = node
    this.#sourceCode = sourceCode
    this.#facts = facts
    this.#previousStatements = previousStatements
    this.parent = parent
    this.#depth = depth
  }

  get edits() {
    return this.#cachedEdits ??= [ ...this.#openingEdits, this.#closingEdit ]
  }

  canFixWith({ parentOpening }) {
    return this.isConvertible && this.#isFixableWith({ parentOpening })
  }

  get isConvertible() {
    return this.#cachedIsConvertible ??= this.#isPlain
      && this.#hasFreshBinding
      && this.#iterable.canUseForEachIn(this.node)
      && !this.#hasOwnEscape
      && !this.#isAccumulation
  }

  problemWith(fix) {
    return { node: this.node, messageId: "preferForEach", fix }
  }

  get #openingEdits() {
    return [ this.#prefixEdit, this.#callbackEdit ]
  }

  get #prefixEdit() {
    return this.#editFor([ this.node.range[0], this.node.right.range[0] ], this.#prefixText)
  }

  #editFor(range, text) {
    return { range, text, depth: this.#depth }
  }

  get #prefixText() {
    return this.#needsReceiverParentheses ? "(" : ""
  }

  get #needsReceiverParentheses() {
    const iterable = this.node.right
    return iterable.type === "NewExpression" && !hasExplicitArgumentList(this.#sourceCode, iterable)
  }

  get #callbackEdit() {
    return this.#editFor([ this.node.right.range[1], this.#body.range[0] ], this.#callbackText)
  }

  get #body() {
    return this.node.body
  }

  get #callbackText() {
    const receiverClosing = this.#needsReceiverParentheses ? ")" : ""
    return `${receiverClosing}.forEach((${this.#paramText}) => ${this.#bodyOpening}`
  }

  get #paramText() {
    return this.#sourceCode.getText(this.node.left.declarations[0].id)
  }

  get #bodyOpening() {
    if (this.#body.type === "BlockStatement") return ""
    if (this.#body.type === "ExpressionStatement") return this.#needsExpressionParentheses ? "(" : ""
    return "{ "
  }

  get #needsExpressionParentheses() {
    return this.#body.type === "ExpressionStatement"
      && EXPRESSION_BODY_PARENS.has(this.#body.expression.type)
      && this.#body.range[0] === this.#body.expression.range[0]
  }

  get #closingEdit() {
    return this.#editFor(this.#closingRange, `${this.#bodyClosing})${this.#statementSeparator}`)
  }

  get #closingRange() {
    if (this.#body.type !== "ExpressionStatement") return [ this.#body.range[1], this.#body.range[1] ]

    const lastToken = this.#sourceCode.getLastToken(this.#body)
    return lastToken.value === ";"
      ? [ lastToken.range[0], this.#body.range[1] ]
      : [ this.#body.range[1], this.#body.range[1] ]
  }

  get #bodyClosing() {
    if (this.#body.type === "BlockStatement") return ""
    if (this.#body.type === "ExpressionStatement") return this.#needsExpressionParentheses ? ")" : ""
    return " }"
  }

  get #statementSeparator() {
    return this.#needsStatementSeparator ? ";" : ""
  }

  get #needsStatementSeparator() {
    const token = this.#followingToken
    return Boolean(token) && token.loc.start.line === this.node.loc.end.line
      && token.value !== ";" && token.value !== "}"
  }

  get #followingToken() {
    return this.#sourceCode.getTokenAfter(this.node)
  }

  #isFixableWith({ parentOpening }) {
    return this.#hasFreshBinding && this.#iterable.isFreshForEachSource
      && this.#hasSafeOpeningWith({ parentOpening })
      && this.#doesNotJoinLineBelow && this.#keepsComments
      && new ForEachFixSafety(this.node, { facts: this.#facts, sourceCode: this.#sourceCode }).isSafe
      && !hasAdjacentToolDirectiveBefore(this.#sourceCode, this.node)
  }

  // Looping over an existing variable or member would change which binding survives the loop.
  get #hasFreshBinding() {
    return this.node.left.type === "VariableDeclaration" && FRESH_BINDING_KINDS.has(this.node.left.kind)
  }

  get #iterable() {
    return this.#cachedIterable ??= new ForEachIterable(this.node.right, this.#sourceCode)
  }

  #hasSafeOpeningWith({ parentOpening }) {
    return this.#isStandingOnOwnLine || (parentOpening && this.parent.body === this.node)
  }

  // `for (const item of [ 1, 2 ])` becomes a statement opening with `[`, which the line above swallows.
  get #isStandingOnOwnLine() {
    return !continuesStatement(this.#receiverStart) || this.#hasClosedLineAbove
  }

  get #receiverStart() {
    return this.#needsReceiverParentheses ? "(" : this.#sourceCode.text[this.node.right.range[0]]
  }

  // A loop above turns into a `.forEach()` in this same pass, ending in `)` where its `}` stands now.
  get #hasClosedLineAbove() {
    return closesStatement(this.#sourceCode.getTokenBefore(this.node)) && !this.#followsLoop
  }

  get #followsLoop() {
    return this.#previousStatement?.type === "ForOfStatement"
  }

  get #previousStatement() {
    return this.#previousStatements.before(this.node)
  }

  get #doesNotJoinLineBelow() {
    return this.#needsStatementSeparator || !continuesStatement(this.#followingToken?.value ?? "")
  }

  get #keepsComments() {
    return commentsIn(this.#sourceCode, this.node.range)
      .every((comment) => this.#preservedNodes.some((node) => isWithin(comment, node.range)))
  }

  get #preservedNodes() {
    return [ this.node.left.declarations[0].id, this.node.right, this.#body ]
  }

  get #isPlain() {
    return !this.node.await
  }

  get #hasOwnEscape() {
    return this.#facts.hasEscapeInside(this.#body.range)
  }

  get #isAccumulation() {
    return new Accumulation(this.node, this.#sourceCode).isPresent
  }
}

function hasExplicitArgumentList(sourceCode, construction) {
  return construction.arguments.length > 0
    || sourceCode.getTokenBefore(sourceCode.getLastToken(construction)).value === "("
}
