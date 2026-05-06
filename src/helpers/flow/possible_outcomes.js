const NORMAL = 1
const THROW = 4
const BREAK = 8
const CONTINUE = 16
// Each completion kind has clean and effectful bits; labeled exits use the same mask as unlabeled exits.
const CLEAN_TYPES = 31
const EFFECT_SHIFT = 5
const EMPTY_LABELS = new Map()

export class PossibleOutcomes {
  #types
  #labels

  static forLabel(label, types) {
    return new PossibleOutcomes(0, new Map([ [ label, types ] ]))
  }

  constructor(types, labels = EMPTY_LABELS) {
    this.#types = types
    this.#labels = labels
  }

  get isEmpty() {
    return this.#types === 0 && !this.hasLabeledControl
  }

  get hasLabeledControl() {
    return this.#labels.size > 0
  }

  hasLabeledContinueFor(loop) {
    for (let current = loop; current.parent?.type === "LabeledStatement" && current.parent.body === current;) {
      current = current.parent
      if ((this.#labels.get(current.label.name) ?? 0) & bothKinds(CONTINUE)) return true
    }
    return false
  }

  hasAny(types) {
    return Boolean(this.#types & bothKinds(types))
  }

  get possiblyEffectful() {
    return this.union(this.effectful)
  }

  union(other) {
    return new PossibleOutcomes(this.#types | other.#types, unionOf(this.#labels, other.#labels))
  }

  get effectful() {
    return new PossibleOutcomes(effectfulKinds(this.#types),
      new Map(this.#labels.entries().map(([ label, types ]) => [ label, effectfulKinds(types) ])))
  }

  withTypes(types) {
    return new PossibleOutcomes(this.#types | types, this.#labels)
  }

  afterLabel(label, { consumesContinue, continueCanComplete }) {
    const types = this.#labels.get(label) ?? 0
    const remaining = consumesContinue ? 0 : types & bothKinds(CONTINUE)
    const labels = new Map(this.#labels)
    if (remaining) labels.set(label, remaining)
    else labels.delete(label)
    return new PossibleOutcomes(
      this.#types | normalKindsFrom(types, BREAK | (continueCanComplete ? CONTINUE : 0)), labels)
  }

  followedBy(next) {
    return this.withoutTypes(NORMAL)
      .union(this.hasCleanAny(NORMAL) ? next : new PossibleOutcomes(0))
      .union(this.hasEffectfulAny(NORMAL) ? next.effectful : new PossibleOutcomes(0))
  }

  withoutTypes(types) {
    return this.onlyTypes(~types)
  }

  onlyTypes(types) {
    return new PossibleOutcomes(this.#types & bothKinds(types), this.#labels)
  }

  hasCleanAny(types) {
    return Boolean(this.#types & types)
  }

  hasEffectfulAny(types) {
    return Boolean(this.#types & (types << EFFECT_SHIFT))
  }

  normalFrom(types) {
    return new PossibleOutcomes(normalKindsFrom(this.#types, types))
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

  get hasCleanOutcome() {
    return this.#hasOutcome(CLEAN_TYPES)
  }

  get hasEffectfulOutcome() {
    return this.#hasOutcome(CLEAN_TYPES << EFFECT_SHIFT)
  }

  #hasOutcome(types) {
    return Boolean(this.#types & types) || this.#labels.values().some((value) => value & types)
  }
}

function bothKinds(types) {
  return (types & CLEAN_TYPES) | ((types & CLEAN_TYPES) << EFFECT_SHIFT)
}

function unionOf(first, second) {
  if (first.size === 0) return second
  if (second.size === 0) return first

  return second.entries().reduce((union, [ label, types ]) =>
    union.set(label, (union.get(label) ?? 0) | types), new Map(first))
}

function effectfulKinds(types) {
  return ((types & CLEAN_TYPES) | (types >> EFFECT_SHIFT)) << EFFECT_SHIFT
}

function normalKindsFrom(types, mask) {
  return (types & mask ? NORMAL : 0) | (types & (mask << EFFECT_SHIFT) ? NORMAL << EFFECT_SHIFT : 0)
}
