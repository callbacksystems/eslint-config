// When a negative guard (`if (!condition) return` or `if (!condition) return V`) is followed by a happy path, wrapping
// it as `if (condition) { ... }` reads more naturally: processing positives is cheaper than negatives. The
// function-length rules already bound how long a happy path can be, so the only real cost of the wrap is the indent
// level it adds: refused when the happy path already nests deeply enough that one more level would breach `max-depth`.
// For value-return guards the value moves into an explicit `else` so the wrap stays a single statement and
// `no-mid-function-returns` is not contradicted.

import { childNodesOf, isSingleLine, pushReversed, statementInsideLabels } from "#helpers/syntax/ast"
import { hasToolDirectiveIn } from "#helpers/source/comment_directives"
import { isClassNode } from "#helpers/syntax/classes"
import { hasDynamicScope } from "#helpers/scope/dynamic_scope"
import { guardReturnOf, isFunction, onFunctions } from "#helpers/syntax/functions"
import { contains } from "#helpers/syntax/ranges"
import {
  commentsIn, conditionSource, hasCommentBeforeCondition, lineEndingOf, negated, nestedCommentText, returnValueSource
} from "#helpers/source/source"
import { reportProblem } from "#helpers/eslint/report"
import { WrappableGuardTail } from "#helpers/flow/wrappable_guard_tail"

const SCOPE_CHANGED_DECLARATION_TYPES = new Set([ "ClassDeclaration", "FunctionDeclaration" ])

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
  #cachedCondition
  #cachedGuardIndex
  #cachedGuardComments
  #cachedHappyPath
  #cachedLineEnding
  #cachedMovedBindings

  constructor(node, sourceCode) {
    this.#node = node
    this.#sourceCode = sourceCode
  }

  get problem() {
    if (this.#guardIndex === -1) return null
    return { node: this.#guard, messageId: "preferPositiveWrap", fix: this.#fix }
  }

  get #guardIndex() {
    return this.#cachedGuardIndex ??= this.#hasBlockBody
      ? new WrappableGuardTail(this.#statements).firstIndex
      : -1
  }

  get #hasBlockBody() {
    return this.#node.body.type === "BlockStatement"
  }

  get #statements() {
    return this.#node.body.body
  }

  get #guard() {
    return this.#statements[this.#guardIndex]
  }

  get #fix() {
    return this.#isFixable ? this.#fixer : null
  }

  get #isFixable() {
    return this.#keepsBindingVisibility && this.#keepsDeclarationValidity
      && this.#keepsTokenValues && !this.#hasHeaderComment && !this.#hasToolDirective
  }

  get #keepsBindingVisibility() {
    return !this.#hasObservableDynamicBinding
      && this.#movedBindings.every((variable) => variable.references.every((reference) =>
        reference.identifier.range[0] >= this.#happyPathStart))
  }

  get #hasObservableDynamicBinding() {
    return this.#movedBindings.length > 0 && hasDynamicScope(this.#sourceCode)
  }

  get #movedBindings() {
    return this.#cachedMovedBindings ??= this.#happyPath.flatMap(scopeChangedDeclarationsIn)
      .flatMap((declaration) => this.#sourceCode.getDeclaredVariables(declaration))
  }

  get #happyPath() {
    return this.#cachedHappyPath ??= this.#statements.slice(this.#guardIndex + 1)
  }

  // A comment between the two was written about the happy path, so it travels into the wrap.
  get #happyPathStart() {
    const gap = [ this.#guard.range[1], this.#happyPath[0].range[0] ]
    return commentsIn(this.#sourceCode, gap)
      .find((comment) => comment.loc.start.line > this.#guard.loc.end.line)
      ?.range[0] ?? this.#happyPath[0].range[0]
  }

  get #keepsDeclarationValidity() {
    return new WrappedDeclarations(this.#happyPath, this.#sourceCode).isValid
  }

  get #keepsTokenValues() {
    return this.#happyPath.every((statement) => this.#sourceCode.getTokens(statement).every(isSingleLine))
  }

  // Its attachment to the `if` header is meaningful, but the generated condition no longer has the same polarity.
  get #hasHeaderComment() {
    return hasCommentBeforeCondition(this.#sourceCode, this.#guard)
  }

  get #hasToolDirective() {
    return hasToolDirectiveIn({ sourceCode: this.#sourceCode, node: this.#guard, range: this.#replacementRange })
  }

  get #replacementRange() {
    return [ this.#guard.range[0], this.#happyPathEnd ]
  }

  get #happyPathEnd() {
    const last = this.#happyPath.at(-1)
    return commentsIn(this.#sourceCode, [ last.range[1], this.#node.body.range[1] ])
      .findLast((comment) => comment.loc.start.line === last.loc.end.line)?.range[1] ?? last.range[1]
  }

  get #fixer() {
    return (fixer) => fixer.replaceTextRange(this.#replacementRange, this.#wrappedHappyPath)
  }

  get #wrappedHappyPath() {
    return `if (${this.#condition}) {${this.#lineEnding}`
      + `${this.#indentedBody}${this.#lineEnding}${this.#indent}}${this.#elseBranch}`
  }

  get #condition() {
    return negated(this.#sourceCode, this.#guard.test, { text: this.#rawCondition.text })
  }

  get #rawCondition() {
    return this.#cachedCondition ??= conditionSource(this.#sourceCode, this.#guard)
  }

  get #lineEnding() {
    return this.#cachedLineEnding ??= lineEndingOf(this.#sourceCode)
  }

  get #indentedBody() {
    const lines = this.#happyPathText.split(this.#lineEnding)
    return [ `${this.#indent}  ${lines[0]}`, ...lines.slice(1).map(indentDeeper) ].join(this.#lineEnding)
  }

  get #happyPathText() {
    return this.#sourceCode.text.slice(this.#happyPathStart, this.#happyPathEnd)
  }

  get #indent() {
    return " ".repeat(this.#guard.loc.start.column)
  }

  get #elseBranch() {
    return this.#hasElseBranch
      ? ` else {${this.#lineEnding}${this.#guardCommentText}${this.#indent}  ${this.#guardReturnText}`
      + `${this.#lineEnding}${this.#indent}}`
      : ""
  }

  get #hasElseBranch() {
    return Boolean(this.#guardReturnValue) || this.#guardComments.length > 0
  }

  get #guardReturnValue() {
    const statement = guardReturnOf(this.#guard)
    return statement.argument ? returnValueSource(this.#sourceCode, statement) : null
  }

  // A comment on the guard remains on the negative path, carried into an explicit `else` when necessary.
  get #guardComments() {
    return this.#cachedGuardComments ??= this.#uncachedGuardComments
  }

  get #uncachedGuardComments() {
    const range = [ this.#guard.range[0], this.#happyPath[0].range[0] ]
    return commentsIn(this.#sourceCode, range)
      .filter((comment) => this.#isGuardComment(comment) && !this.#isPreservedInReplacement(comment))
  }

  #isGuardComment(comment) {
    return comment.range[1] <= this.#guard.range[1]
      || comment.loc.start.line === this.#guard.loc.end.line
  }

  #isPreservedInReplacement(comment) {
    return [ this.#rawCondition, this.#guardReturnValue ]
      .filter(Boolean)
      .some((source) => contains(source, comment))
  }

  get #guardCommentText() {
    return nestedCommentText(this.#guardComments, {
      sourceCode: this.#sourceCode, indent: this.#indent, lineEnding: this.#lineEnding
    })
  }

  get #guardReturnText() {
    return this.#guardReturnValue ? `return ${this.#guardReturnValue.text}` : "return"
  }
}

function scopeChangedDeclarationsIn(statement) {
  const unwrapped = statementInsideLabels(statement)
  return SCOPE_CHANGED_DECLARATION_TYPES.has(unwrapped.type) || isBlockScopedVariable(unwrapped) ? [ unwrapped ] : []
}

function isBlockScopedVariable(statement) {
  return statement.type === "VariableDeclaration" && statement.kind !== "var"
}

// Function declarations are var-like in a function body but lexical inside the generated block. Two with the same name,
// or one sharing a name with any `var` declared by that block, would turn valid input into an early error.
class WrappedDeclarations {
  #statements
  #sourceCode
  #cachedFunctionNames
  #cachedVarNames

  constructor(statements, sourceCode) {
    this.#statements = statements
    this.#sourceCode = sourceCode
  }

  get isValid() {
    return new Set(this.#functionNames).size === this.#functionNames.length
      && this.#functionNames.every((name) => !this.#varNames.has(name))
  }

  get #functionNames() {
    return this.#cachedFunctionNames ??= this.#statements.flatMap(functionNamesDeclaredBy)
  }

  get #varNames() {
    return this.#cachedVarNames ??= new Set(this.#varDeclarations
      .flatMap((declaration) => this.#sourceCode.getDeclaredVariables(declaration))
      .map((variable) => variable.name))
  }

  get #varDeclarations() {
    return [ ...new VariableDeclarations(this.#statements) ]
  }
}

function functionNamesDeclaredBy(statement) {
  const unwrapped = statementInsideLabels(statement)
  return unwrapped.type === "FunctionDeclaration" && unwrapped.id ? [ unwrapped.id.name ] : []
}

class VariableDeclarations {
  #pending

  constructor(statements) {
    this.#pending = statements.toReversed()
  }

  *[Symbol.iterator]() {
    while (this.#pending.length > 0) {
      const node = this.#pending.pop()
      if (node.type === "VariableDeclaration" && node.kind === "var") yield node
      if (!isFunction(node) && !isClassNode(node)) pushReversed(this.#pending, childNodesOf(node))
    }
  }
}

function indentDeeper(line) {
  return line === "" ? line : `  ${line}`
}
