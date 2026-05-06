import { pushReversed } from "#helpers/syntax/ast"
import { isMutableBinding } from "#helpers/scope/binding_mutability"

export class DynamicBindingCoverage {
  #evalCount
  #mutableBindings = new WeakSet()
  #shadowCounts = new Map()

  constructor(scopeManager, evalScopes) {
    this.#evalCount = evalScopes.size
    if (this.#evalCount > 0) {
      const bindings = new VisibleBindings(scopeManager.scopes, evalScopes)
      for (const binding of bindings) this.#add(binding)
    }
  }

  intercepts(lookup) {
    return lookup.hasBindingIn(this.#mutableBindings)
      || (lookup.isUnresolved && this.#evalCount > 0 && !this.#shadowsGlobal(lookup.name))
  }

  #add(binding) {
    if (binding.isMutable) this.#mutableBindings.add(binding.variable)
    if (binding.isLocal) increment(this.#shadowCounts, binding.name, binding.count)
  }

  #shadowsGlobal(name) {
    return this.#shadowCounts.get(name) === this.#evalCount
  }
}

class VisibleBindings {
  #scopes
  #tree
  #hiddenCounts

  constructor(scopes, evalScopes) {
    this.#scopes = scopes
    this.#tree = new ScopeTree(scopes, evalScopes)
    this.#hiddenCounts = new BindingShadows(this.#tree).counts
  }

  *[Symbol.iterator]() {
    for (const scope of this.#scopes) {
      for (const variable of scope.variables) {
        const binding = this.#bindingFor(variable, scope)
        if (binding.count > 0) yield binding
      }
    }
  }

  #bindingFor(variable, scope) {
    const count = this.#tree.evalCountIn(scope) - (this.#hiddenCounts.get(variable) ?? 0)
    return new VisibleBinding(variable, count)
  }
}

class ScopeTree {
  #children = new Map()
  #evalCounts = new Map()
  #roots = []

  constructor(scopes, evalScopes) {
    scopes.forEach((scope) => this.#add(scope))
    for (const event of this.events()) {
      if (!event.entering) this.#countEvalsIn(event.scope, evalScopes)
    }
  }

  *events() {
    const pending = this.#roots.toReversed().map((scope) => new ScopeEvent(scope, true))
    while (pending.length > 0) {
      const event = pending.pop()
      event.scheduleIn(pending, this.#children.get(event.scope))
      yield event
    }
  }

  evalCountIn(scope) {
    return this.#evalCounts.get(scope) ?? 0
  }

  #add(scope) {
    if (scope.upper) this.#addChild(scope.upper, scope)
    else this.#roots.push(scope)
  }

  #addChild(parent, child) {
    if (!this.#children.has(parent)) this.#children.set(parent, [])
    this.#children.get(parent).push(child)
  }

  #countEvalsIn(scope, evalScopes) {
    const childCount = this.#children.get(scope)?.reduce((sum, child) => sum + this.evalCountIn(child), 0) ?? 0
    this.#evalCounts.set(scope, childCount + Number(evalScopes.has(scope)))
  }
}

class ScopeEvent {
  constructor(scope, entering) {
    this.scope = scope
    this.entering = entering
  }

  scheduleIn(pending, children) {
    if (this.entering) {
      pending.push(new ScopeEvent(this.scope, false))
      if (children) pushReversed(pending, children.map((scope) => new ScopeEvent(scope, true)))
    }
  }
}

class BindingShadows {
  counts = new WeakMap()

  #currentByName = new Map()
  #previousByBinding = new WeakMap()
  #tree

  constructor(tree) {
    this.#tree = tree
    for (const event of tree.events()) this.#record(event)
  }

  #record(event) {
    if (event.entering) this.#enter(event.scope)
    else this.#leave(event.scope)
  }

  #enter(scope) {
    scope.variables.forEach((variable) => this.#enterBinding(variable, scope))
  }

  #enterBinding(variable, scope) {
    const previous = this.#currentByName.get(variable.name)
    if (previous) {
      this.#previousByBinding.set(variable, previous)
      increment(this.counts, previous, this.#tree.evalCountIn(scope))
    }
    this.#currentByName.set(variable.name, variable)
  }

  #leave(scope) {
    scope.variables.toReversed().forEach((variable) => this.#leaveBinding(variable))
  }

  #leaveBinding(variable) {
    const previous = this.#previousByBinding.get(variable)
    if (previous) this.#currentByName.set(variable.name, previous)
    else this.#currentByName.delete(variable.name)
  }
}

function increment(collection, key, amount) {
  collection.set(key, (collection.get(key) ?? 0) + amount)
}

class VisibleBinding {
  constructor(variable, count) {
    this.variable = variable
    this.count = count
  }

  get name() {
    return this.variable.name
  }

  get isLocal() {
    return Boolean(this.variable.scope.upper)
  }

  get isMutable() {
    return isMutableBinding(this.variable)
  }
}
