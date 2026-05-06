// A trailing bare `return` or `return undefined` is noise in side-effect-only functions. `return null` stays because
// null is an observable result distinct from the implicit undefined.

import { onFunctions, ownReturnArguments } from "#helpers/syntax/functions"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { hasAdjacentToolDirectiveBefore, isToolDirective } from "#helpers/source/comment_directives"
import { hasDynamicScopeIn } from "#helpers/scope/dynamic_scope"
import { reportProblem } from "#helpers/eslint/report"
import { holdsComment, rangeStartingAfterLastComment } from "#helpers/source/source"

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Disallow trailing bare or undefined returns in side-effect-only functions" },
    schema: [],
    messages: { redundantTrailingReturn: "Remove this trailing return. JS returns `undefined` implicitly." }
  },
  create(context) {
    const bindings = new BindingResolver(context.sourceCode)
    return onFunctions((node) => reportProblem(context, new FunctionReturn(node, context.sourceCode, bindings)))
  }
}

class FunctionReturn {
  #node
  #sourceCode
  #bindings
  #cachedTrailingComments

  constructor(node, sourceCode, bindings) {
    this.#node = node
    this.#sourceCode = sourceCode
    this.#bindings = bindings
  }

  get problem() {
    return this.#isRedundant
      ? { node: this.#trailing, messageId: "redundantTrailingReturn", fix: this.#fix }
      : null
  }

  get #isRedundant() {
    return this.#hasStatements
      && this.#statements.length >= 2
      && this.#isUndefinedReturn(this.#trailing)
      && ownReturnArguments(this.#node).every((argument) => this.#isUndefinedValue(argument))
  }

  get #hasStatements() {
    return this.#node.body.type === "BlockStatement"
  }

  get #statements() {
    return this.#node.body.body
  }

  #isUndefinedReturn(statement) {
    return statement.type === "ReturnStatement" && this.#isUndefinedValue(statement.argument)
  }

  #isUndefinedValue(argument) {
    if (!argument) return true
    if (argument.type !== "Identifier" || argument.name !== "undefined") return false
    if (hasDynamicScopeIn(this.#sourceCode, argument)) return false

    const binding = this.#bindings.variableFor(argument)
    return !binding || binding.defs.length === 0
  }

  get #trailing() {
    return this.#statements.at(-1)
  }

  get #fix() {
    return this.#isFixable ? (fixer) => fixer.removeRange(this.#removalRange) : null
  }

  get #isFixable() {
    return !holdsComment(this.#sourceCode, this.#trailing.range)
      && !this.#hasTrailingToolDirective
      && (!this.#hasTrailingComment || this.#isOnOwnLine)
      && !hasAdjacentToolDirectiveBefore(this.#sourceCode, this.#trailing)
  }

  get #hasTrailingToolDirective() {
    return this.#trailingComments.some((comment) => isToolDirective(comment.value))
  }

  get #trailingComments() {
    return this.#cachedTrailingComments ??= this.#sourceCode.getCommentsAfter(this.#trailing)
      .filter((comment) => comment.loc.start.line === this.#trailing.loc.end.line)
  }

  get #hasTrailingComment() {
    return this.#trailingComments.length > 0
  }

  get #isOnOwnLine() {
    return this.#sourceCode.getTokenBefore(this.#trailing).loc.end.line < this.#trailing.loc.start.line
  }

  get #removalRange() {
    if (this.#hasTrailingComment) return [ this.#trailing.range[0], this.#trailingComments[0].range[0] ]

    const separator = [ this.#sourceCode.getTokenBefore(this.#trailing).range[1], this.#trailing.range[1] ]
    return rangeStartingAfterLastComment(this.#sourceCode, separator)
  }
}
