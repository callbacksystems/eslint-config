import { RangedEvents } from "#helpers/syntax/ranged_events"

export class ForEachConversionFacts {
  #contexts = [ new ScopeFacts() ]

  enterFunction(node = null) {
    if (node?.type === "FunctionDeclaration") this.current.addFunctionDeclaration(node)
    this.enterScope()
  }

  get current() {
    return this.#contexts.at(-1)
  }

  enterScope() {
    this.#contexts.push(new ScopeFacts())
  }

  leaveScope() {
    this.#contexts.pop()
  }

  addVariableDeclaration(node) {
    this.current.addVariableDeclaration(node)
  }

  addAwaitLoop(node) {
    if (node.await) this.addEscape(node)
  }

  addEscape(node) {
    this.current.addEscape(node)
  }
}

class ScopeFacts {
  #escapes = new RangedEvents()
  #scopeChanges = new RangedEvents()

  addFunctionDeclaration(node) {
    this.#scopeChanges.add(node.range[0])
  }

  addVariableDeclaration(node) {
    if (node.kind === "await using") this.addEscape(node)
    else if (node.kind === "var") this.#scopeChanges.add(node.range[0])
  }

  addEscape(node) {
    this.#escapes.add(node.range[0])
  }

  hasEscapeInside(range) {
    return this.#escapes.hasInside(range)
  }

  hasCallbackScopeChangeInside(range) {
    return this.#scopeChanges.hasInside(range)
  }
}
