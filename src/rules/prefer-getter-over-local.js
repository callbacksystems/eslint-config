// A local that reuses a finder result (`const user = findUser()` or `const user = User.find(id)`), or that aliases an
// instance-state member of the same name (`const account = this.user.account`), read several times in a class method is
// hidden state. Make it a memoized getter so the whole class shares one source of truth. Read once is handled by
// unnecessary-local-variable; outside a class it is left alone.

import { readReferences } from "#helpers/ast"
import { enclosingFunction, sharesFunction } from "#helpers/functions"
import { capitalize, isPascalCase, uncapitalize } from "#helpers/naming"
import { reportProblem } from "#helpers/report"

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
    return { VariableDeclarator: (node) => reportProblem(context, new FinderLocal(node, context.sourceCode)) }
  }
}

class FinderLocal {
  #node
  #sourceCode

  constructor(node, sourceCode) {
    this.#node = node
    this.#sourceCode = sourceCode
  }

  get problem() {
    return this.#shouldBeGetter
      ? { node: this.#node, messageId: "preferGetter", data: { name: this.#node.id.name } }
      : null
  }

  get #shouldBeGetter() {
    return this.#aliasesState && this.#isInsideClassMethod && this.#isReusedInScope
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
    const enclosing = enclosingFunction(this.#node)
    return Boolean(enclosing) && enclosing.parent.type === "MethodDefinition"
  }

  get #isReusedInScope() {
    const reads = this.#reads
    return reads.length >= 2 && reads.every((read) => sharesFunction(this.#node, read.identifier))
  }

  get #reads() {
    return readReferences(this.#sourceCode, this.#node)
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
      && this.#callee.property.type === "Identifier"
      && CLASS_FINDERS.has(this.#callee.property.name)
      && this.#name === uncapitalize(this.#callee.object.name)
  }
}

// The local just renames a `this`-based member, so a getter can hold it: the receiver stays in scope.
function isSameNameThisMember(name, member) {
  return !member.computed
    && member.property.type === "Identifier"
    && member.property.name === name
    && isThisBased(member.object)
}

function isThisBased(node) {
  return node.type === "ThisExpression" || (node.type === "MemberExpression" && isThisBased(node.object))
}
