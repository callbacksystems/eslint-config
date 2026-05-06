export class LocalFunctionCalls {
  #functionNode
  #view

  constructor(functionNode, view) {
    this.#functionNode = functionNode
    this.#view = view
  }

  get values() {
    return this.#view.isExportedDeclaration(this.#functionNode)
      ? null
      : new FunctionAliasWalk(this.#functionNode, this.#view).calls
  }
}

class FunctionAliasWalk {
  #calls = []
  #functionNode
  #isConfined = true
  #pending
  #seen = new Set()
  #view

  constructor(functionNode, view) {
    this.#functionNode = functionNode
    this.#pending = [ functionNode ]
    this.#view = view
  }

  get calls() {
    while (this.#isConfined && this.#pending.length > 0) this.#follow(this.#pending.pop())
    return this.#isConfined ? this.#calls : null
  }

  #follow(subject) {
    if (this.#seen.has(subject)) return

    this.#seen.add(subject)
    this.#view.referencesTo(subject).forEach((reference) => this.#followReference(reference.identifier))
  }

  #followReference(identifier) {
    const { invocation, alias } = new FunctionReferenceUse(identifier, this.#functionNode, this.#view)
    if (invocation) this.#calls.push(invocation)
    else if (alias) this.#pending.push(alias)
    else this.#isConfined = false
  }
}

class FunctionReferenceUse {
  #functionNode
  #identifier
  #view

  constructor(identifier, functionNode, view) {
    this.#functionNode = functionNode
    this.#identifier = identifier
    this.#view = view
  }

  get invocation() {
    const { parent } = this.#identifier
    return parent?.type === "CallExpression" && parent.callee === this.#identifier ? parent : null
  }

  get alias() {
    const declarator = this.#aliasDeclarator
    return declarator && this.#isStableLocalAlias(declarator) ? declarator.id : null
  }

  get #aliasDeclarator() {
    const { parent } = this.#identifier
    return parent?.type === "VariableDeclarator" && this.#isIdentifierAlias(parent) ? parent : null
  }

  #isIdentifierAlias(declarator) {
    return declarator.init === this.#identifier && declarator.id.type === "Identifier"
  }

  #isStableLocalAlias(declarator) {
    return !this.#view.isExportedDeclaration(declarator)
      && this.#view.functionFor(declarator.id) === this.#functionNode
  }
}
