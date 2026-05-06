export class MethodIdentityIndex {
  #instance = new VisibilityMethodIdentities()
  #static = new VisibilityMethodIdentities()

  identityFor(key, { isStatic }) {
    return key ? this.#identitiesFor(isStatic).identityFor(key) : null
  }

  #identitiesFor(isStatic) {
    return isStatic ? this.#static : this.#instance
  }
}

class VisibilityMethodIdentities {
  #private = new Map()
  #public = new Map()

  identityFor(key) {
    const identities = key.isPrivate ? this.#private : this.#public
    if (!identities.has(key.value)) identities.set(key.value, {})
    return identities.get(key.value)
  }
}
