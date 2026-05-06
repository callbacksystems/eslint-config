export class ClassMemberMap {
  #instance = new VisibilityMemberMap()
  #static = new VisibilityMemberMap()

  get(key) {
    return this.#valuesFor(key).get(key)
  }

  has(key) {
    return this.#valuesFor(key).has(key)
  }

  set(key, value) {
    this.#valuesFor(key).set(key, value)
  }

  #valuesFor(key) {
    return key.isStatic ? this.#static : this.#instance
  }
}

class VisibilityMemberMap {
  #private = new Map()
  #public = new Map()

  get(key) {
    return this.#valuesFor(key).get(key.value)
  }

  has(key) {
    return this.#valuesFor(key).has(key.value)
  }

  set(key, value) {
    this.#valuesFor(key).set(key.value, value)
  }

  #valuesFor(key) {
    return key.isPrivate ? this.#private : this.#public
  }
}
