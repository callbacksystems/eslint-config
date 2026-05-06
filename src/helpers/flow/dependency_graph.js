export class DependencyGraph {
  #entries
  #cachedByName

  constructor(entries) {
    this.#entries = entries
  }

  namesFrom(seeds, { select = null } = {}) {
    return new DependencyWalk(this.#byName, select).namesFrom(seeds)
  }

  get roots() {
    const referenced = new Set(this.#entries.flatMap((entry) => entry.references))
    return this.#entries.map((entry) => entry.name).filter((name) => !referenced.has(name))
  }

  get #byName() {
    return this.#cachedByName ??= new Map(this.#entries.map((entry) => [ entry.name, entry.references ]))
  }
}

class DependencyWalk {
  #byName
  #select
  #visited = new Set()
  #collected = []
  #pending = []

  constructor(byName, select) {
    this.#byName = byName
    this.#select = select
  }

  namesFrom(seeds) {
    seeds.forEach((seed) => this.#visitFrom(seed))
    return this.#collected
  }

  #visitFrom(seed) {
    this.#pending.push(seed)
    while (this.#pending.length > 0) this.#visitNext()
  }

  #visitNext() {
    const name = this.#pending.pop()
    if (this.#visited.has(name) || !this.#byName.has(name)) return

    this.#visited.add(name)
    if (!this.#select || this.#select(name)) this.#collected.push(name)
    this.#byName.get(name).toReversed().forEach((reference) => {
      this.#pending.push(reference)
    })
  }
}
