// A method that memoizes should do nothing else: `this.#user ??= load()` is the
// whole point. Validation, logging, or any other work around it belongs in its
// own method. Returning the memoized field, guarding the memoization with `if`,
// or wrapping it in `try` is part of the memoization and is left alone.

import { firstMatch, isIfWithoutAlternate, isMemoization, isThisMember } from "#helpers/ast"
import { reportProblem } from "#helpers/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow mixing memoization with other statements in the same method" },
    schema: [],
    messages: { mixedMemoization: "Memoization should be the whole method body. Move other work to its own method." }
  },
  create(context) {
    return { MethodDefinition: (node) => reportProblem(context, new MemoizingMethod(node.value.body)) }
  }
}

class MemoizingMethod {
  #body
  #cachedMemoization

  constructor(body) {
    this.#body = body
  }

  get problem() {
    return this.#isMixed ? { node: this.#memoization, messageId: "mixedMemoization" } : null
  }

  get #isMixed() {
    return Boolean(this.#memoization) && !this.#isEntirelyMemoization
  }

  get #memoization() {
    return this.#cachedMemoization ??= firstMatch(this.#body, isMemoization)
  }

  get #isEntirelyMemoization() {
    return new MemoizationStatements(this.#statements).areAllRelated
  }

  get #statements() {
    return this.#body?.type === "BlockStatement" ? this.#body.body : []
  }
}

class MemoizationStatements {
  #statements

  constructor(statements) {
    this.#statements = statements
  }

  get areAllRelated() {
    return this.#statements.every((statement) => new MemoizationStatement(statement).isRelated)
  }
}

class MemoizationStatement {
  #statement

  constructor(statement) {
    this.#statement = statement
  }

  get isRelated() {
    return this.#isAssignment || this.#isFieldReturn || this.#isGuarded || this.#isTry
  }

  get #isAssignment() {
    return (this.#statement.type === "ExpressionStatement" && isMemoization(this.#statement.expression))
      || (this.#statement.type === "ReturnStatement" && isMemoization(this.#statement.argument))
  }

  get #isFieldReturn() {
    return this.#statement.type === "ReturnStatement" && isThisMember(this.#statement.argument)
  }

  get #isGuarded() {
    return isIfWithoutAlternate(this.#statement) && new MemoizationStatements(this.#consequent).areAllRelated
  }

  get #consequent() {
    const { consequent } = this.#statement
    return consequent.type === "BlockStatement" ? consequent.body : [ consequent ]
  }

  get #isTry() {
    return this.#statement.type === "TryStatement" && new MemoizationStatements(this.#tryBody).areAllRelated
  }

  get #tryBody() {
    return this.#statement.block.body
  }
}
