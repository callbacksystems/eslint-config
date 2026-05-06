import { ClassMemberMap } from "#helpers/classes/class_member_map"

const ABSENT_MEMBER = { functionNode: null, isAbsent: true, isUnknown: false }
const UNKNOWN_MEMBER = { functionNode: null, isAbsent: false, isUnknown: true }

export class ClassMemberHierarchy {
  #membersOf
  #resolutionsBySuperclass = new WeakMap()

  constructor(membersOf) {
    this.#membersOf = membersOf
  }

  resolutionFor(classNode, { before, key, kind, superclassOf }) {
    return new MemberHierarchy(classNode, {
      cache: this.#cacheFor(superclassOf),
      membersOf: this.#membersOf,
      before,
      key,
      kind,
      superclassOf
    }).resolution
  }

  #cacheFor(superclassOf) {
    if (!this.#resolutionsBySuperclass.has(superclassOf)) {
      this.#resolutionsBySuperclass.set(superclassOf, new HierarchyResolutionCache())
    }
    return this.#resolutionsBySuperclass.get(superclassOf)
  }
}

class MemberHierarchy {
  #before
  #cache
  #cacheableClasses = []
  #current
  #isCacheable
  #key
  #kind
  #membersOf
  #superclassOf
  #visited = new WeakSet()

  constructor(classNode, { before, cache, key, kind, membersOf, superclassOf }) {
    this.#before = before
    this.#cache = cache
    this.#current = classNode
    this.#isCacheable = before === null
    this.#key = key
    this.#kind = kind
    this.#membersOf = membersOf
    this.#superclassOf = superclassOf
  }

  get resolution() {
    while (this.#canAdvance) {
      const resolution = this.#currentResolution
      if (resolution) return this.#remember(resolution)

      this.#advance()
      if (this.#current?.isUnknown) return this.#remember(UNKNOWN_MEMBER)
    }
    return this.#remember(this.#current ? UNKNOWN_MEMBER : ABSENT_MEMBER)
  }

  get #canAdvance() {
    return Boolean(this.#current) && !this.#visited.has(this.#current)
  }

  get #currentResolution() {
    this.#visited.add(this.#current)
    return this.#cachedResolution ?? this.#ownResolution
  }

  get #cachedResolution() {
    return this.#isCacheable ? this.#resolutionRememberedForCurrent : null
  }

  get #resolutionRememberedForCurrent() {
    this.#cacheableClasses.push(this.#current)
    return this.#cache.get(this.#current, this.#key, this.#kind)
  }

  get #ownResolution() {
    const resolution = this.#membersOf(this.#current)
      .resolutionFor(this.#key, this.#kind, { before: this.#before })
    return !resolution.isAbsent || this.#key.isPrivate ? resolution : null
  }

  #remember(resolution) {
    this.#cacheableClasses.forEach((classNode) =>
      this.#cache.set(classNode, this.#key, { kind: this.#kind, resolution }))
    return resolution
  }

  #advance() {
    this.#current = this.#superclassOf(this.#current)
    this.#before = null
  }
}

class HierarchyResolutionCache {
  #byClass = new WeakMap()

  get(classNode, key, kind) {
    return this.#byClass.get(classNode)?.get(key)?.get(kind) ?? null
  }

  set(classNode, key, { kind, resolution }) {
    if (!this.#byClass.has(classNode)) this.#byClass.set(classNode, new ClassMemberMap())
    const byKind = this.#byClass.get(classNode)
    if (!byKind.has(key)) byKind.set(key, new Map())
    byKind.get(key).set(kind, resolution)
  }
}
