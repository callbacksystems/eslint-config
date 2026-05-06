// A method that memoizes should do nothing else: `this.#user ??= load()` is the whole point. Validation, logging, or
// any other work around it belongs in its own method. Returning the memoized field, guarding the memoization with `if`,
// or wrapping it in `try` is part of the memoization and is left alone.

import { ClassThisBindings } from "#helpers/classes/class_this_bindings"
import { pushAll } from "#helpers/syntax/ast"
import { isMemoization, isThisMember, staticMemberKeyOf } from "#helpers/syntax/classes"
import { isIfWithoutAlternate, ownNodesIn } from "#helpers/syntax/functions"
import { reportProblem } from "#helpers/eslint/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow mixing memoization with other statements in the same method" },
    schema: [],
    messages: { mixedMemoization: "Memoization should be the whole method body. Move other work to its own method." }
  },
  create(context) {
    const ownership = new MemoizationOwnership(context.sourceCode.ast)
    return { MethodDefinition: (node) => reportProblem(context, new MemoizingMethod(node.value, ownership)) }
  }
}

class MemoizationOwnership {
  #root
  #cachedBindings

  constructor(root) {
    this.#root = root
  }

  belongsTo(memoization, method) {
    return this.#bindings.isExecutedBy(memoization.left.object, method)
  }

  get #bindings() {
    return this.#cachedBindings ??= new ClassThisBindings(this.#root)
  }
}

class MemoizingMethod {
  #function
  #ownership
  #cachedMemoizations

  constructor(functionNode, ownership) {
    this.#function = functionNode
    this.#ownership = ownership
  }

  get problem() {
    return this.#isMixed ? { node: this.#memoizations[0], messageId: "mixedMemoization" } : null
  }

  get #isMixed() {
    return this.#memoizations.length > 0 && (this.#hasSeveralTargets || !this.#isEntirelyMemoization)
  }

  get #memoizations() {
    return this.#cachedMemoizations ??= ownNodesIn(this.#function)
      .filter((node) => isMemoization(node) && this.#ownership.belongsTo(node, this.#function))
      .toArray()
  }

  get #hasSeveralTargets() {
    const target = new MemoizedField(this.#memoizations[0].left)
    return this.#memoizations.some((memoization) => !target.matches(memoization.left))
  }

  get #isEntirelyMemoization() {
    return new MemoizationStatements(
      this.#function.body.body,
      new MemoizedField(this.#memoizations[0].left)
    ).areAllRelated
  }
}

class MemoizedField {
  #member
  #key

  constructor(member) {
    this.#member = member
    this.#key = staticMemberKeyOf(member)
  }

  matches(member) {
    return member === this.#member || this.#matchesEquivalentMember(member)
  }

  #matchesEquivalentMember(member) {
    const key = isThisMember(member) ? staticMemberKeyOf(member) : null
    return this.#key !== null && key !== null
      && this.#key.name === key.name && this.#hasSameVisibilityAs(key)
  }

  #hasSameVisibilityAs(key) {
    return this.#isPrivate ? key.node.type === "PrivateIdentifier" : key.node.type !== "PrivateIdentifier"
  }

  get #isPrivate() {
    return this.#key.node.type === "PrivateIdentifier"
  }
}

class MemoizationStatements {
  #pending
  #target

  constructor(statements, target) {
    this.#pending = [ ...statements ]
    this.#target = target
  }

  get areAllRelated() {
    while (this.#pending.length > 0) {
      const statement = new MemoizationStatement(this.#pending.pop(), this.#target)
      if (!statement.isRelated) return false

      pushAll(this.#pending, statement.nestedStatements)
    }
    return true
  }
}

class MemoizationStatement {
  #statement
  #target

  constructor(statement, target) {
    this.#statement = statement
    this.#target = target
  }

  get isRelated() {
    return this.#isAssignment || this.#isFieldReturn || this.#isGuarded || this.#isTry
  }

  get nestedStatements() {
    if (this.#isGuarded) return this.#consequent
    return this.#statement.type === "TryStatement" ? this.#tryBody : []
  }

  get #isAssignment() {
    const expression = this.#statement.type === "ExpressionStatement"
      ? this.#statement.expression
      : this.#statement.argument
    return (this.#statement.type === "ExpressionStatement" || this.#statement.type === "ReturnStatement")
      && isMemoization(expression) && this.#target.matches(expression.left)
  }

  get #isFieldReturn() {
    return this.#statement.type === "ReturnStatement" && isThisMember(this.#statement.argument)
      && this.#target.matches(this.#statement.argument)
  }

  get #isGuarded() {
    return isIfWithoutAlternate(this.#statement)
  }

  get #isTry() {
    return this.#statement.type === "TryStatement"
      && new FallbackStatements(this.#catchBody).areAllFallbacks
      && !this.#statement.finalizer
  }

  get #catchBody() {
    return this.#statement.handler?.body.body ?? []
  }

  get #consequent() {
    const { consequent } = this.#statement
    return consequent.type === "BlockStatement" ? consequent.body : [ consequent ]
  }

  get #tryBody() {
    return this.#statement.block.body
  }
}

class FallbackStatements {
  #pending

  constructor(statements) {
    this.#pending = [ ...statements ]
  }

  get areAllFallbacks() {
    while (this.#pending.length > 0) {
      const statement = new FallbackStatement(this.#pending.pop())
      if (!statement.isPresent) return false

      pushAll(this.#pending, statement.nestedStatements)
    }
    return true
  }
}

class FallbackStatement {
  #statement

  constructor(statement) {
    this.#statement = statement
  }

  get isPresent() {
    return this.#isExit || this.#isContainer
  }

  get nestedStatements() {
    if (this.#statement.type === "BlockStatement") return this.#statement.body
    if (this.#statement.type === "IfStatement") {
      return [ this.#statement.consequent, this.#statement.alternate ].filter(Boolean)
    }
    return []
  }

  get #isExit() {
    return this.#statement.type === "ReturnStatement" || this.#statement.type === "ThrowStatement"
  }

  get #isContainer() {
    return this.#statement.type === "BlockStatement" || this.#statement.type === "IfStatement"
  }
}
