export class FunctionEffectGraph {
  #effects = new Map()
  #cachedPropagation

  effectsOf(functionNode) {
    if (!this.#effects.has(functionNode)) this.#effects.set(functionNode, new FunctionEffects(functionNode))
    return this.#effects.get(functionNode)
  }

  get mutatingFunctions() {
    return this.#propagation.mutatingFunctions
  }

  get unknownFunctions() {
    return this.#propagation.unknownFunctions
  }

  get #propagation() {
    return this.#cachedPropagation ??= new EffectPropagation(this.#effects)
  }
}

class FunctionEffects {
  constructor(functionNode) {
    this.fresh = new FunctionEffect(functionNode)
    this.normal = new FunctionEffect(functionNode)
  }

  forReceiver(hasFreshReceiver) {
    return hasFreshReceiver ? this.fresh : this.normal
  }

  markUnknown() {
    this.states.forEach((effect) => {
      effect.isDirectlyUnknown = true
    })
  }

  get states() {
    return [ this.normal, this.fresh ]
  }

  addBindingMutation(mutation) {
    if (mutation) this.states.forEach((effect) => effect.bindingMutations.add(mutation.boundary))
  }
}

class FunctionEffect {
  bindingMutations = new Set()
  callees = new Set()
  isDirectlyUnknown = false
  mutatesDirectly = false

  constructor(functionNode) {
    this.functionNode = functionNode
  }

  addDirect(direct) {
    if (direct.exists) this.mutatesDirectly = true
    else if (direct.isUnknown) this.isDirectlyUnknown = true
  }

  addFunction(effect) {
    if (effect) this.callees.add(effect)
  }
}

class EffectPropagation {
  #effects
  #parents = new Map()

  constructor(effects) {
    this.#effects = effects
    this.#index()
  }

  get mutatingFunctions() {
    return this.#functionsWith(this.#propagateBindingMutations(this.#mutatingStates))
  }

  get unknownFunctions() {
    return this.#functionsWith(this.#propagatedStates((effect) => effect.isDirectlyUnknown))
  }

  #index() {
    this.#effects.forEach((effects) => {
      effects.states.forEach((effect) => {
        effect.callees.forEach((callee) => this.#parentsOf(callee).add(effect))
      })
    })
  }

  #parentsOf(effect) {
    if (!this.#parents.has(effect)) this.#parents.set(effect, new Set())
    return this.#parents.get(effect)
  }

  #functionsWith(states) {
    return new Set(Array.from(this.#effects)
      .filter(([ , effects ]) => states.has(effects.normal))
      .map(([ functionNode ]) => functionNode))
  }

  #propagateBindingMutations(states) {
    const pending = Array.from(this.#effects.values()).flatMap((effects) => effects.states
      .flatMap((effect) => Array.from(effect.bindingMutations, (boundary) => ({ boundary, effect }))))
    const visited = new Map()
    while (pending.length > 0) this.#propagateBindingMutation(pending.pop(), { pending, states, visited })
    return states
  }

  #propagateBindingMutation(state, { pending, states, visited }) {
    if (state.effect.functionNode === state.boundary || visitedFor(state.boundary, visited).has(state.effect)) return

    visitedFor(state.boundary, visited).add(state.effect)
    states.add(state.effect)
    this.#parents.get(state.effect)?.forEach((effect) => {
      pending.push({ boundary: state.boundary, effect })
    })
  }

  get #mutatingStates() {
    return this.#propagatedStates((effect) => effect.mutatesDirectly)
  }

  #propagatedStates(matches) {
    return this.#propagate(new Set(this.#states.filter(matches)))
  }

  #propagate(states) {
    for (const effect of states) {
      this.#parents.get(effect)?.forEach((parent) => states.add(parent))
    }
    return states
  }

  get #states() {
    return Array.from(this.#effects.values()).flatMap((effects) => effects.states)
  }
}

function visitedFor(boundary, visited) {
  if (!visited.has(boundary)) visited.set(boundary, new WeakSet())
  return visited.get(boundary)
}
