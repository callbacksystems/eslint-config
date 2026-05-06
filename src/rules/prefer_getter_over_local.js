// A local that reuses a finder result (`const user = findUser()` or `const user = User.find(id)`), or that aliases an
// instance-state member of the same name (`const account = this.user.account`), read several times in a class method is
// hidden state. Make it a memoized getter so the whole class shares one source of truth. Read once is handled by
// unnecessary-local-variable; outside a class it is left alone.

import { calleeMemberName, propertyNameOf } from "#helpers/syntax/classes"
import { resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { nodesIn, readReferences } from "#helpers/syntax/ast"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { hasDynamicScopeIn } from "#helpers/scope/dynamic_scope"
import { enclosingFunction, isFunction, sharesFunction } from "#helpers/syntax/functions"
import { capitalize, isPascalCase, uncapitalize } from "#helpers/strings/naming"
import { NearestAncestor } from "#helpers/syntax/nearest_ancestor"
import { contains } from "#helpers/syntax/ranges"
import { reportProblem } from "#helpers/eslint/report"

const FINDER_PREFIXES = [ "find", "get", "fetch", "load" ]
const CLASS_FINDERS = new Set([ "find", "findBy" ])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer a memoized getter over a local that reuses class state in a class method" },
    schema: [],
    messages: { preferGetter: "`{{name}}` reuses class state. Make it a memoized getter `get {{name}}()`." }
  },
  create(context) {
    const bindings = new BindingResolver(context.sourceCode)
    return { VariableDeclarator: (node) => reportProblem(context, new FinderLocal(node, context.sourceCode, bindings)) }
  }
}

class FinderLocal {
  #node
  #sourceCode
  #bindings
  #cachedReads
  #cachedMethod

  constructor(node, sourceCode, bindings) {
    this.#node = node
    this.#sourceCode = sourceCode
    this.#bindings = bindings
  }

  get problem() {
    return this.#shouldBeGetter
      ? { node: this.#node, messageId: "preferGetter", data: { name: this.#node.id.name } }
      : null
  }

  get #shouldBeGetter() {
    return this.#aliasesState && this.#isInsideClassMethod && this.#canAddGetter
      && this.#isIndependentOfMethod && !hasDynamicScopeIn(this.#sourceCode, this.#node)
      && this.#isStable && this.#isReusedInScope
  }

  get #aliasesState() {
    return this.#assignsFinder || this.#assignsSameNameMember
  }

  get #assignsFinder() {
    const { id, init } = this.#node
    return id.type === "Identifier" && Boolean(init) && new Finder(id.name, init).isPresent
  }

  get #assignsSameNameMember() {
    const { id, init } = this.#node
    return id.type === "Identifier" && init?.type === "MemberExpression" && isSameNameThisMember(id.name, init)
  }

  get #isInsideClassMethod() {
    return Boolean(this.#method)
  }

  get #method() {
    return this.#cachedMethod ??= this.#enclosingMethod
  }

  get #enclosingMethod() {
    const enclosing = enclosingFunction(this.#node)
    return enclosing?.parent.type === "MethodDefinition" ? enclosing.parent : null
  }

  get #canAddGetter() {
    return new GetterSlot(this.#method, this.#node.id.name, this.#bindings).isAvailable
  }

  get #isIndependentOfMethod() {
    return new GetterInitializer(this.#node.init, this.#method.value, this.#bindings).isIndependent
  }

  get #isStable() {
    return this.#bindings.isUnmodified(this.#node.id)
  }

  get #isReusedInScope() {
    return this.#reads.length >= 2 && this.#reads.every((read) => sharesFunction(this.#node, read.identifier))
  }

  get #reads() {
    return this.#cachedReads ??= readReferences(this.#sourceCode, this.#node)
  }
}

class Finder {
  #name
  #init

  constructor(name, init) {
    this.#name = name
    this.#init = init
  }

  get isPresent() {
    return this.#init.type === "CallExpression" && (this.#isNamed || this.#isClassFinder)
  }

  get #isNamed() {
    return this.#callee.type === "Identifier"
      && FINDER_PREFIXES.some((prefix) => this.#callee.name === prefix + capitalize(this.#name))
  }

  get #callee() {
    return this.#init.callee
  }

  get #isClassFinder() {
    return this.#callee.type === "MemberExpression"
      && this.#callee.object.type === "Identifier"
      && isPascalCase(this.#callee.object.name)
      && CLASS_FINDERS.has(calleeMemberName(this.#callee))
      && this.#name === uncapitalize(this.#callee.object.name)
  }
}

// A local that renames a `this`-based member can become a getter, since the receiver stays in scope.
function isSameNameThisMember(name, member) {
  return member.object.type !== "ThisExpression" && propertyNameOf(member) === name && isThisBased(member.object)
}

function isThisBased(node) {
  for (let current = node; current?.type === "MemberExpression"; current = current.object) {
    if (current.object.type === "ThisExpression") return true
  }
  return node.type === "ThisExpression"
}

class GetterSlot {
  static #namesByClassBody = new WeakMap()

  #method
  #name
  #bindings

  static #memberNamesIn(classBody, bindings) {
    if (!this.#namesByClassBody.has(classBody)) {
      this.#namesByClassBody.set(classBody, new PublicMemberNames(classBody.body, bindings))
    }
    return this.#namesByClassBody.get(classBody)
  }

  constructor(method, name, bindings) {
    this.#method = method
    this.#name = name
    this.#bindings = bindings
  }

  get isAvailable() {
    return !this.#isReserved && !this.#hasCollision
  }

  get #isReserved() {
    return this.#method.static ? this.#name === "prototype" : this.#name === "constructor"
  }

  get #hasCollision() {
    return GetterSlot.#memberNamesIn(this.#method.parent, this.#bindings)
      .includes(this.#name, { isStatic: this.#method.static })
  }
}

class PublicMemberNames {
  #instance = new Set()
  #static = new Set()
  #bindings

  constructor(members, bindings) {
    this.#bindings = bindings
    for (const member of members) this.#add(member)
  }

  includes(name, { isStatic }) {
    return this.#namesFor({ isStatic }).has(name)
  }

  #add(member) {
    if (member.kind !== "set") {
      const key = resolvedMemberKeyOf(member, this.#bindings)
      const name = key?.node.type === "PrivateIdentifier" ? null : key?.name ?? null
      if (name !== null) this.#namesFor({ isStatic: member.static }).add(name)
    }
  }

  #namesFor({ isStatic }) {
    return isStatic ? this.#static : this.#instance
  }
}

class GetterInitializer {
  #node
  #method
  #bindings
  #functionOwners = new FunctionOwners()

  constructor(node, method, bindings) {
    this.#node = node
    this.#method = method
    this.#bindings = bindings
  }

  get isIndependent() {
    return nodesIn(this.#node).every((node) => !this.#isMethodLocalReference(node)
      && !this.#isMethodOnlySyntax(node))
  }

  #isMethodLocalReference(node) {
    return node.type === "Identifier"
      ? new MethodLocalReference(node, {
        initializer: this.#node,
        method: this.#method,
        bindings: this.#bindings
      }).isPresent
      : false
  }

  #isMethodOnlySyntax(node) {
    return hasMethodOnlyShape(node) && this.#isOwnedByMethod(node)
  }

  #isOwnedByMethod(node) {
    return this.#functionOwners.ownerOf(node, { includingArrows: node.type === "AwaitExpression" }) === this.#method
  }
}

class FunctionOwners {
  #lexical = new NearestAncestor(rebindsThis)
  #syntax = new NearestAncestor(isFunction)

  ownerOf(node, { includingArrows }) {
    return (includingArrows ? this.#syntax : this.#lexical).above(node)
  }
}

function rebindsThis(node) {
  return node.type !== "ArrowFunctionExpression" && isFunction(node)
}

class MethodLocalReference {
  #identifier
  #initializer
  #method
  #bindings

  constructor(identifier, { initializer, method, bindings }) {
    this.#identifier = identifier
    this.#initializer = initializer
    this.#method = method
    this.#bindings = bindings
  }

  get isPresent() {
    const scopeNode = this.#bindings.variableFor(this.#identifier)?.scope.block
    return Boolean(scopeNode) && this.#isMethodLocal(scopeNode)
  }

  #isMethodLocal(scopeNode) {
    return contains(this.#method, scopeNode) && !contains(this.#initializer, scopeNode)
  }
}

function hasMethodOnlyShape(node) {
  return node.type === "AwaitExpression"
    || node.type === "YieldExpression"
    || (node.type === "MetaProperty" && node.meta.name === "new")
    || (node.type === "CallExpression" && node.callee.type === "Super")
}
