export class LandingEvaluation {
  #pending = []
  #visited = new WeakMap()
  #isRunning = false
  #result = null

  keeps(landing) {
    this.#schedule(landing)
    if (this.#isRunning) return true
    if (this.#result !== null) return this.#result

    this.#isRunning = true
    try {
      this.#result = this.#isEveryPendingKept
      return this.#result
    } finally {
      this.#isRunning = false
    }
  }

  #schedule(landing) {
    const visits = this.#visited.get(landing.node) ?? new Set()
    const kind = landing.containerKind ?? "value"
    if (visits.has(kind)) return

    visits.add(kind)
    this.#visited.set(landing.node, visits)
    this.#pending.push(landing)
  }

  get #isEveryPendingKept() {
    while (this.#result !== false && this.#pending.length > 0) {
      this.#result = this.#pending.pop().isImmediatelyKept
    }
    return this.#result
  }
}
