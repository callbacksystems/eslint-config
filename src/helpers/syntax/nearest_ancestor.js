// Find the nearest matching ancestor with path compression, so repeated queries over one tree visit each shared path
// only once.

export class NearestAncestor {
  #matches
  #values = new WeakMap()

  constructor(matches) {
    this.#matches = matches
  }

  above(node) {
    return this.of(node?.parent)
  }

  of(node) {
    return new AncestorWalk(node, { matches: this.#matches, values: this.#values }).value
  }
}

class AncestorWalk {
  #current
  #matches
  #values
  #path = []

  constructor(node, { matches, values }) {
    this.#current = node
    this.#matches = matches
    this.#values = values
  }

  get value() {
    while (this.#current && !this.#values.has(this.#current)) {
      this.#path.push(this.#current)
      if (this.#matches(this.#current)) return this.#remember(this.#current)

      this.#current = this.#current.parent
    }
    return this.#remember(this.#current ? this.#values.get(this.#current) : null)
  }

  #remember(value) {
    this.#path.forEach((node) => this.#values.set(node, value))
    return value
  }
}
