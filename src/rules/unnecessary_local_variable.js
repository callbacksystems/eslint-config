// `const directory = forbiddenDirectory()` read only once is a needless alias: call it directly, or extract a
// well-named method. A value read more than once, read inside a nested function (where it may be an accumulator or
// guard against re-evaluation), or read only to restore state in a `finally`/`catch` is left alone. The inline fix runs
// only when the single read is in the very next statement, so moving the call cannot cross an intervening side effect.

import { isResourceDeclaration, readReferences } from "#helpers/syntax/ast"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { hasAdjacentToolDirectiveBefore, isToolDirective } from "#helpers/source/comment_directives"
import { hasDirectEvalIn, hasDynamicScope } from "#helpers/scope/dynamic_scope"
import { NearestAncestor } from "#helpers/syntax/nearest_ancestor"
import { contains, isWithin } from "#helpers/syntax/ranges"
import { closesStatement, commentsIn, continuesStatement, replaceReference } from "#helpers/source/source"
import { sharesFunction } from "#helpers/syntax/functions"
import { InlineSite } from "#helpers/flow/inline_site"
import { reportProblem } from "#helpers/eslint/report"

const ALIAS_TYPES = new Set([ "CallExpression", "MemberExpression" ])

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Disallow a local variable that aliases a call used only once" },
    schema: [],
    messages: { unnecessaryLocal: "`{{name}}` aliases a call used once. Call it directly or extract a method." }
  },
  create(context) {
    const bindings = new BindingResolver(context.sourceCode)
    const followingStatements = new FollowingStatements()
    const recoveryRegions = new RecoveryRegions()
    return {
      VariableDeclarator: (node) => reportProblem(context, new Alias(node, context.sourceCode, {
        bindings,
        followingStatements,
        recoveryRegions
      }))
    }
  }
}

class FollowingStatements {
  #values = new WeakMap()

  after(statement) {
    if (!this.#values.has(statement)) this.#indexSiblingsOf(statement)
    return this.#values.get(statement) ?? null
  }

  #indexSiblingsOf(statement) {
    const siblings = statement.parent?.body
    if (Array.isArray(siblings)) {
      siblings.forEach((sibling, index) => this.#values.set(sibling, siblings[index + 1] ?? null))
    } else {
      this.#values.set(statement, null)
    }
  }
}

class RecoveryRegions {
  #regions = new NearestAncestor(isRecoveryRegion)

  includes(node) {
    return Boolean(this.#regions.above(node))
  }
}

function isRecoveryRegion(node) {
  return node.type === "CatchClause" || (node.parent?.type === "TryStatement" && node.parent.finalizer === node)
}

class Alias {
  #node
  #sourceCode
  #bindings
  #followingStatements
  #recoveryRegions
  #cachedReads

  constructor(node, sourceCode, { bindings, followingStatements, recoveryRegions }) {
    this.#node = node
    this.#sourceCode = sourceCode
    this.#bindings = bindings
    this.#followingStatements = followingStatements
    this.#recoveryRegions = recoveryRegions
  }

  get problem() {
    return this.#isNeedless
      ? { node: this.#node, messageId: "unnecessaryLocal", data: { name: this.#node.id.name }, fix: this.#fix }
      : null
  }

  get #isNeedless() {
    return this.#isAliasingCall && !hasDirectEvalIn(this.#sourceCode, this.#node)
      && this.#isStable && this.#isReadOnceInScope && !this.#isRestoringState
  }

  get #isAliasingCall() {
    const { id, init } = this.#node
    return id.type === "Identifier" && Boolean(init) && ALIAS_TYPES.has(init.type)
      && !isResourceDeclaration(this.#declaration)
  }

  get #declaration() {
    return this.#node.parent
  }

  get #isStable() {
    return this.#bindings.isUnmodified(this.#node.id)
  }

  get #isReadOnceInScope() {
    return this.#reads.length === 1 && !this.#reads[0].isWrite() && sharesFunction(this.#node, this.#read)
  }

  get #reads() {
    return this.#cachedReads ??= readReferences(this.#sourceCode, this.#node)
  }

  get #read() {
    return this.#reads[0].identifier
  }

  get #isRestoringState() {
    return this.#recoveryRegions.includes(this.#read)
  }

  get #fix() {
    if (this.#isInlineable) {
      return (fixer) => [
        fixer.removeRange([ this.#declaration.range[0], this.#removalEnd ]),
        replaceReference(fixer, this.#read, this.#inlineText)
      ]
    } else {
      return null
    }
  }

  // Nothing may run between the call and its use, or the call's evaluation order could change.
  get #isInlineable() {
    return this.#hasAdjacentRead && this.#hasStaticScopeAndOrder
      && this.#canPreserveDeclarationComments && !this.#hasAdjacentDirective
      && !this.#hasTrailingDirective && this.#standsWhereItLands
  }

  get #hasAdjacentRead() {
    return this.#isSingleDeclaration && Boolean(this.#nextStatement) && this.#containsRead(this.#nextStatement)
  }

  get #isSingleDeclaration() {
    return this.#declaration.type === "VariableDeclaration" && this.#declaration.declarations.length === 1
  }

  get #nextStatement() {
    return this.#followingStatements.after(this.#declaration)
  }

  #containsRead(statement) {
    return isWithin(this.#read, statement.range)
  }

  get #hasStaticScopeAndOrder() {
    return !hasDynamicScope(this.#sourceCode) && this.#isPreservingEvaluation
  }

  get #isPreservingEvaluation() {
    return new InlineSite({
      read: this.#read,
      statement: this.#nextStatement,
      value: this.#node.init,
      bindings: this.#bindings
    }).isSafe
  }

  get #canPreserveDeclarationComments() {
    return commentsIn(this.#sourceCode, this.#declaration.range).every((comment) =>
      contains(this.#node.init, comment))
  }

  get #hasAdjacentDirective() {
    return hasAdjacentToolDirectiveBefore(this.#sourceCode, this.#declaration)
  }

  get #hasTrailingDirective() {
    return this.#sourceCode.getCommentsAfter(this.#declaration)
      .some((comment) => comment.loc.start.line === this.#declaration.loc.end.line
        && isToolDirective(comment.value))
  }

  // Removing a declaration must not expose a continuation (`[`, `(`, and friends) to the previous statement.
  get #standsWhereItLands() {
    return closesStatement(this.#sourceCode.getTokenBefore(this.#declaration))
      || !continuesStatement(this.#nextStatementText)
  }

  get #nextStatementText() {
    return this.#read.range[0] === this.#nextStatement.range[0]
      ? this.#inlineText
      : this.#sourceCode.getText(this.#nextStatement)
  }

  // An object literal where a statement starts parses as a block, and the parentheses are what say it is a value.
  get #inlineText() {
    return this.#needsParentheses ? `(${this.#initText})` : this.#initText
  }

  get #needsParentheses() {
    return this.#isObjectAtStatementStart || this.#isCallUsedAsConstructor
  }

  get #isObjectAtStatementStart() {
    return this.#initText.startsWith("{") && this.#read.range[0] === this.#nextStatement.range[0]
  }

  get #initText() {
    return this.#sourceCode.getText(this.#node.init)
  }

  get #isCallUsedAsConstructor() {
    const { parent } = this.#read
    return this.#node.init.type === "CallExpression" && parent.type === "NewExpression" && parent.callee === this.#read
  }

  // A comment between the declaration and its use explains the value, so it stays while the alias goes.
  get #removalEnd() {
    return this.#sourceCode.getCommentsBefore(this.#nextStatement)[0]?.range[0] ?? this.#nextStatement.range[0]
  }
}
