// Each summary keeps the original traversal order but stops at the rule's threshold. A parent that is not already full
// has fewer possible overlaps than that prefix contains, so composing capped summaries cannot change the verdict.
export class ThreadedReachIndex {
  #index
  #limit
  #facts = new WeakMap()
  #summaries = new WeakMap()

  constructor(index, limit) {
    this.#index = index
    this.#limit = limit
  }

  calleesFrom(variable) {
    if (!this.hasSummaryFor(variable)) this.#buildFrom(variable)
    return this.summaryFor(variable)
  }

  hasSummaryFor(variable) {
    return this.#summaries.has(variable)
  }

  summaryFor(variable) {
    return this.#summaries.get(variable) ?? new Set()
  }

  factsFor(variable) {
    if (!this.#facts.has(variable)) this.#facts.set(variable, new ReachFacts(variable, this.#index))
    return this.#facts.get(variable)
  }

  #buildFrom(variable) {
    const summaries = new ReachSummaryWalk(variable, this, this.#limit).values
    if (summaries) summaries.forEach((summary, reachedVariable) => this.#summaries.set(reachedVariable, summary))
    else this.#summaries.set(variable, new UncachedReach(variable, this.#index, this.#limit).callees)
  }
}

class ReachFacts {
  #variable
  #index
  #cachedCallees
  #cachedFlows
  #cachedParameters

  constructor(variable, index) {
    this.#variable = variable
    this.#index = index
  }

  get callees() {
    return this.#cachedCallees ??= [ ...new Set(this.#flows.map((flow) => flow.callee)) ]
  }

  get parameters() {
    return this.#cachedParameters ??= [ ...new Set(this.#flows.toReversed()
      .map((flow) => this.#index.parameterAt(flow.functionNode, flow.position))
      .filter(Boolean)) ]
  }

  get #flows() {
    return this.#cachedFlows ??= this.#variable.references
      .map((reference) => this.#index.flowOf(reference))
      .filter(Boolean)
  }
}

class ReachSummaryWalk {
  #reaches
  #limit
  #pending
  #active = new Set()
  #built = new Map()
  #hasCycle = false

  constructor(root, reaches, limit) {
    this.#reaches = reaches
    this.#limit = limit
    this.#pending = [ new ReachFrame(root) ]
  }

  get values() {
    while (!this.#hasCycle && this.#pending.length > 0) this.#visit(this.#pending.pop())
    return this.#hasCycle ? null : this.#built
  }

  #visit(frame) {
    if (this.#isKnown(frame.variable)) return

    if (frame.isReady) this.#finish(frame.variable)
    else this.#enter(frame.variable)
  }

  #isKnown(variable) {
    return this.#reaches.hasSummaryFor(variable) || this.#built.has(variable)
  }

  #finish(variable) {
    this.#active.delete(variable)
    this.#built.set(variable, new ReachSummary(this.#reaches.factsFor(variable), {
      limit: this.#limit,
      summaryOf: (dependency) => this.#summaryOf(dependency)
    }).callees)
  }

  #summaryOf(variable) {
    return this.#reaches.hasSummaryFor(variable) ? this.#reaches.summaryFor(variable) : this.#built.get(variable)
  }

  #enter(variable) {
    const facts = this.#reaches.factsFor(variable)
    this.#active.add(variable)
    this.#pending.push(new ReachFrame(variable, { isReady: true }))
    if (facts.callees.length < this.#limit) {
      facts.parameters.toReversed().forEach((dependency) => this.#schedule(dependency))
    }
  }

  #schedule(variable) {
    if (this.#active.has(variable)) this.#hasCycle = true
    else if (!this.#isKnown(variable)) this.#pending.push(new ReachFrame(variable))
  }
}

class ReachFrame {
  constructor(variable, { isReady = false } = {}) {
    this.variable = variable
    this.isReady = isReady
  }
}

class ReachSummary {
  #facts
  #limit
  #summaryOf
  #reached = new Set()

  constructor(facts, { limit, summaryOf }) {
    this.#facts = facts
    this.#limit = limit
    this.#summaryOf = summaryOf
  }

  get callees() {
    this.#add(this.#facts.callees)
    for (const parameter of this.#facts.parameters) {
      if (this.#isFull) break

      this.#add(this.#summaryOf(parameter))
    }
    return this.#reached
  }

  #add(callees) {
    const availableCallees = callees ?? []
    for (const callee of availableCallees) {
      if (this.#isFull) break

      this.#reached.add(callee)
    }
  }

  get #isFull() {
    return this.#reached.size >= this.#limit
  }
}

class UncachedReach {
  #index
  #limit
  #pending
  #visited = new Set()
  #callees = new Set()

  constructor(variable, index, limit) {
    this.#index = index
    this.#limit = limit
    this.#pending = [ variable ]
  }

  get callees() {
    while (this.#pending.length > 0 && this.#callees.size < this.#limit) this.#spreadFrom(this.#pending.pop())
    return this.#callees
  }

  #spreadFrom(variable) {
    if (this.#visited.has(variable)) return

    this.#visited.add(variable)
    variable.references.forEach((reference) => this.#follow(reference))
  }

  #follow(reference) {
    const flow = this.#index.flowOf(reference)
    if (flow && this.#callees.size < this.#limit) {
      this.#callees.add(flow.callee)
      const parameter = this.#index.parameterAt(flow.functionNode, flow.position)
      if (parameter && !this.#visited.has(parameter)) this.#pending.push(parameter)
    }
  }
}
