export class ResolutionCache {
  #steps
  #fallback
  #values = new WeakMap()

  static final(value) {
    return new ResolutionStep(true, value)
  }

  static following(variable) {
    return new ResolutionStep(false, variable)
  }

  constructor(steps, fallback) {
    this.#steps = steps
    this.#fallback = fallback
  }

  valueFrom(variable) {
    return new BindingWalk({ variable, cache: this.#values, steps: this.#steps, fallback: this.#fallback }).value
  }
}

class ResolutionStep {
  constructor(isFinal, value) {
    this.isFinal = isFinal
    this.value = value
  }

  get next() {
    return this.value
  }
}

class BindingWalk {
  #current
  #cache
  #steps
  #fallback
  #path = []
  #seen = new Set()

  constructor({ variable, cache, steps, fallback }) {
    this.#current = variable
    this.#cache = cache
    this.#steps = steps
    this.#fallback = fallback
  }

  get value() {
    while (this.#canAdvance) {
      const step = this.#steps.stepFrom(this.#current)
      this.#rememberCurrent()
      if (step.isFinal) return this.#remember(step.value)

      this.#moveTo(step.next)
    }
    return this.#remember(this.#endingValue)
  }

  get #canAdvance() {
    return Boolean(this.#current) && this.#isUncachedAndUnseen
  }

  get #isUncachedAndUnseen() {
    return !this.#cache.has(this.#current) && !this.#seen.has(this.#current)
  }

  #rememberCurrent() {
    this.#seen.add(this.#current)
    this.#path.push(this.#current)
  }

  #remember(value) {
    this.#path.forEach((variable) => this.#cache.set(variable, value))
    return value
  }

  #moveTo(variable) {
    this.#current = variable
  }

  get #endingValue() {
    return this.#isCached ? this.#cache.get(this.#current) : this.#fallback
  }

  get #isCached() {
    return Boolean(this.#current) && this.#cache.has(this.#current)
  }
}
