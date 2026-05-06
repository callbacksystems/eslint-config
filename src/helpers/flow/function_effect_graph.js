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
    const byBoundary = new Map()
    this.#states.forEach((effect) => effect.bindingMutations.forEach((boundary) => {
      if (effect.functionNode !== boundary) statesFor(boundary, byBoundary).add(effect)
    }))
    byBoundary.forEach((seeds, boundary) => this.#propagate(seeds, boundary).forEach((effect) => states.add(effect)))
    return states
  }

  get #states() {
    return Array.from(this.#effects.values()).flatMap((effects) => effects.states)
  }

  #propagate(states, boundary = null) {
    for (const effect of states) {
      this.#parents.get(effect)?.forEach((parent) => {
        if (parent.functionNode !== boundary) states.add(parent)
      })
    }
    return states
  }

  get #mutatingStates() {
    return this.#propagatedStates((effect) => effect.mutatesDirectly)
  }

  #propagatedStates(matches) {
    return this.#propagate(new Set(this.#states.filter(matches)))
  }
}

function statesFor(boundary, groups) {
  if (!groups.has(boundary)) groups.set(boundary, new Set())
  return groups.get(boundary)
}
