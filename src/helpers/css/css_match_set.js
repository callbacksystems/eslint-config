const ANY_ELEMENT = 0
const META_ELEMENT = 1
const OTHER_ELEMENT = 2
const STATE_COUNT = 6
const NAMED_META_STATE = 3
const TYPE_INTERSECTIONS = [
  [ ANY_ELEMENT, META_ELEMENT, OTHER_ELEMENT ],
  [ META_ELEMENT, META_ELEMENT, null ],
  [ OTHER_ELEMENT, null, OTHER_ELEMENT ]
]

export class CssMatchSet {
  #bits

  static get empty() {
    return new CssMatchSet(0)
  }

  static get unconstrained() {
    return new CssMatchSet(1)
  }

  constructor(bits) {
    this.#bits = bits
  }

  get hasNamedMeta() {
    return this.includes(NAMED_META_STATE)
  }

  includes(state) {
    return Boolean(this.#bits & bitFor(state))
  }

  get hasNamedElement() {
    return [ 1, 3, 5 ].some((state) => this.includes(state))
  }

  constrainedByType(name) {
    return name === null || name === "*" ? this : this.intersectedWith(typeConstraintFor(name))
  }

  intersectedWith(other) {
    let bits = 0
    for (let state = 0; state < STATE_COUNT; state += 1) bits |= this.#intersectionsFor(state, other)
    return new CssMatchSet(bits)
  }

  withName() {
    let bits = 0
    for (let state = 0; state < STATE_COUNT; state += 1) {
      if (this.includes(state)) bits |= bitFor(state | 1)
    }
    return new CssMatchSet(bits)
  }

  unionWith(other) {
    return new CssMatchSet(this.#bits | other.#bits)
  }

  #intersectionsFor(first, other) {
    return this.includes(first) ? new CssStateIntersections(first, other).bits : 0
  }
}

function bitFor(state) {
  return 1 << state
}

function typeConstraintFor(name) {
  const type = name === "meta" ? META_ELEMENT : OTHER_ELEMENT
  return new CssMatchSet(bitFor(stateFor(type, false)))
}

function stateFor(type, hasName) {
  return (type * 2) + Number(hasName)
}

class CssStateIntersections {
  bits = 0

  #first
  #other

  constructor(first, other) {
    this.#first = first
    this.#other = other
    for (let second = 0; second < STATE_COUNT; second += 1) {
      this.bits |= new CssStateIntersection(this.#first, second).bitsIn(this.#other)
    }
  }
}

class CssStateIntersection {
  #first
  #second

  constructor(first, second) {
    this.#first = first
    this.#second = second
  }

  bitsIn(matchSet) {
    return matchSet.includes(this.#second) ? this.#bits : 0
  }

  get value() {
    const type = TYPE_INTERSECTIONS[typeOf(this.#first)][typeOf(this.#second)]
    return type === null ? null : stateFor(type, this.#hasName)
  }

  get #bits() {
    const { value } = this
    return value === null ? 0 : bitFor(value)
  }

  get #hasName() {
    return hasNameIn(this.#first) || hasNameIn(this.#second)
  }
}

function typeOf(state) {
  return Math.floor(state / 2)
}

function hasNameIn(state) {
  return state % 2 === 1
}
