const NORMAL = 1
const THROW = 4

export class PossibleOutcomes {
  breakLabels = new Set()
  cleanTypes = 0
  continueLabels = new Set()
  effectfulBreakLabels = new Set()
  effectfulContinueLabels = new Set()
  effectfulTypes = 0

  constructor(cleanTypes, {
    breakLabels = new Set(), continueLabels = new Set(), effectfulBreakLabels = new Set(),
    effectfulContinueLabels = new Set(), effectfulTypes = 0
  } = {}) {
    this.cleanTypes = cleanTypes
    this.breakLabels = breakLabels
    this.continueLabels = continueLabels
    this.effectfulTypes = effectfulTypes
    this.effectfulBreakLabels = effectfulBreakLabels
    this.effectfulContinueLabels = effectfulContinueLabels
  }

  get isEmpty() {
    return !this.hasCleanOutcome && !this.hasEffectfulOutcome
  }

  get hasCleanOutcome() {
    return this.cleanTypes !== 0 || this.breakLabels.size > 0 || this.continueLabels.size > 0
  }

  get hasEffectfulOutcome() {
    return this.effectfulTypes !== 0 || this.effectfulBreakLabels.size > 0 || this.effectfulContinueLabels.size > 0
  }

  get hasLabeledControl() {
    return [ this.breakLabels, this.continueLabels, this.effectfulBreakLabels, this.effectfulContinueLabels ]
      .some((labels) => labels.size > 0)
  }

  hasLabeledContinueFor(loop) {
    for (let current = loop; current.parent?.type === "LabeledStatement" && current.parent.body === current;) {
      current = current.parent
      const { name } = current.label
      if (this.continueLabels.has(name) || this.effectfulContinueLabels.has(name)) return true
    }
    return false
  }

  hasAny(types) {
    return this.hasCleanAny(types) || this.hasEffectfulAny(types)
  }

  hasCleanAny(types) {
    return Boolean(this.cleanTypes & types)
  }

  hasEffectfulAny(types) {
    return Boolean(this.effectfulTypes & types)
  }

  get possiblyEffectful() {
    return this.union(this.effectful)
  }

  union(other) {
    return new PossibleOutcomes(this.cleanTypes | other.cleanTypes, {
      breakLabels: this.breakLabels.union(other.breakLabels),
      continueLabels: this.continueLabels.union(other.continueLabels),
      effectfulTypes: this.effectfulTypes | other.effectfulTypes,
      effectfulBreakLabels: this.effectfulBreakLabels.union(other.effectfulBreakLabels),
      effectfulContinueLabels: this.effectfulContinueLabels.union(other.effectfulContinueLabels)
    })
  }

  get effectful() {
    return new PossibleOutcomes(0, {
      effectfulTypes: this.cleanTypes | this.effectfulTypes,
      effectfulBreakLabels: this.breakLabels.union(this.effectfulBreakLabels),
      effectfulContinueLabels: this.continueLabels.union(this.effectfulContinueLabels)
    })
  }

  onlyTypes(types) {
    return new PossibleOutcomes(this.cleanTypes & types, {
      breakLabels: this.breakLabels,
      continueLabels: this.continueLabels,
      effectfulTypes: this.effectfulTypes & types,
      effectfulBreakLabels: this.effectfulBreakLabels,
      effectfulContinueLabels: this.effectfulContinueLabels
    })
  }

  withTypes(types) {
    return new PossibleOutcomes(this.cleanTypes | types, {
      breakLabels: this.breakLabels,
      continueLabels: this.continueLabels,
      effectfulTypes: this.effectfulTypes,
      effectfulBreakLabels: this.effectfulBreakLabels,
      effectfulContinueLabels: this.effectfulContinueLabels
    })
  }

  afterLabel(label, { consumesContinue, continueCanComplete }) {
    return new PossibleOutcomes(
      completesAtLabel(label, {
        breakLabels: this.breakLabels, continueLabels: this.continueLabels, continueCanComplete
      })
        ? this.cleanTypes | NORMAL
        : this.cleanTypes,
      {
        breakLabels: withoutValue(this.breakLabels, label),
        continueLabels: consumesContinue ? withoutValue(this.continueLabels, label) : this.continueLabels,
        effectfulTypes: completesAtLabel(label, {
          breakLabels: this.effectfulBreakLabels,
          continueLabels: this.effectfulContinueLabels,
          continueCanComplete
        })
          ? this.effectfulTypes | NORMAL
          : this.effectfulTypes,
        effectfulBreakLabels: withoutValue(this.effectfulBreakLabels, label),
        effectfulContinueLabels: consumesContinue
          ? withoutValue(this.effectfulContinueLabels, label)
          : this.effectfulContinueLabels
      })
  }

  followedBy(next) {
    return this.withoutTypes(NORMAL)
      .union(this.hasCleanAny(NORMAL) ? next : new PossibleOutcomes(0))
      .union(this.hasEffectfulAny(NORMAL) ? next.effectful : new PossibleOutcomes(0))
  }

  withoutTypes(types) {
    return new PossibleOutcomes(this.cleanTypes & ~types, {
      breakLabels: this.breakLabels,
      continueLabels: this.continueLabels,
      effectfulTypes: this.effectfulTypes & ~types,
      effectfulBreakLabels: this.effectfulBreakLabels,
      effectfulContinueLabels: this.effectfulContinueLabels
    })
  }

  normalFrom(types) {
    return new PossibleOutcomes(this.hasCleanAny(types) ? NORMAL : 0, {
      effectfulTypes: this.hasEffectfulAny(types) ? NORMAL : 0
    })
  }

  caughtBy(handler) {
    return this.withoutTypes(THROW)
      .union(this.hasCleanAny(THROW) ? handler : new PossibleOutcomes(0))
      .union(this.hasEffectfulAny(THROW) ? handler.effectful : new PossibleOutcomes(0))
  }

  finalizedBy(finalizer) {
    return new PossibleOutcomes(0)
      .union(finalizer.hasCleanAny(NORMAL) ? this : new PossibleOutcomes(0))
      .union(finalizer.hasEffectfulAny(NORMAL) ? this.effectful : new PossibleOutcomes(0))
      .union(this.hasCleanOutcome ? finalizer.withoutTypes(NORMAL) : new PossibleOutcomes(0))
      .union(this.hasEffectfulOutcome ? finalizer.withoutTypes(NORMAL).effectful : new PossibleOutcomes(0))
  }
}

function completesAtLabel(label, { breakLabels, continueLabels, continueCanComplete }) {
  return breakLabels.has(label) || (continueCanComplete && continueLabels.has(label))
}

function withoutValue(values, value) {
  return values.difference(new Set([ value ]))
}
