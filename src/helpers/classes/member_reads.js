import bounds from "binary-search-bounds"
import { nodesIn } from "#helpers/syntax/ast"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { classDeclaringPrivate, staticMemberKeyOf } from "#helpers/syntax/classes"
import { ClassHierarchy } from "#helpers/classes/class_hierarchy"

export class MemberReads {
  #bindings
  #dynamic = new NamedMemberReads()
  #hierarchy
  #private = new PrivateMemberReads()
  #privateKinds = new PrivateMemberKinds()
  #public
  #resolver
  #unplaced = new MemberReadsByKind()

  constructor(sourceCode, bindings) {
    this.#bindings = bindings
    this.#hierarchy = new ClassHierarchy(sourceCode)
    this.#public = new PublicMemberReads(this.#hierarchy)
    this.#resolver = BindingResolver.for(sourceCode)
    for (const node of nodesIn(sourceCode)) {
      if (node.type === "MemberExpression" && node.parent.type !== "ExpressionStatement") this.#add(node)
    }
  }

  valuesFor(member, { owner, isStatic }) {
    const key = new MemberReadKey(member)
    if (key.isPrivate) return this.#private.valuesFor(key.name, { owner, isStatic })

    return [
      ...this.#public.valuesFor(key.name, { owner, isStatic }),
      ...this.#unplaced.valuesFor(key.name, { isStatic }),
      ...this.#dynamic.valuesFor(key.name)
    ]
  }

  #add(node) {
    const location = new MemberReadLocation(node, {
      bindings: this.#bindings,
      hierarchy: this.#hierarchy,
      privateKinds: this.#privateKinds,
      resolver: this.#resolver
    })
    if (location.isPrivate) {
      this.#private.add(location.name, node, { owner: location.owner, isStatic: location.isStatic })
    } else if (location.isDynamic) {
      this.#dynamic.add(location.name, node)
    } else if (location.isUnplaced) {
      this.#unplaced.add(location.name, node, { isStatic: location.isStatic })
    } else {
      this.#public.add(location.name, node, { owner: location.owner, isStatic: location.isStatic })
    }
  }
}

class NamedMemberReads {
  #byName = new Map()

  add(name, node) {
    const reads = this.#byName.get(name) ?? []
    reads.push(node)
    this.#byName.set(name, reads)
  }

  valuesFor(name) {
    const named = this.#valuesNamed(name)
    return name === null ? named : [ ...named, ...this.#valuesNamed(null) ]
  }

  #valuesNamed(name) {
    return this.#byName.get(name) ?? []
  }
}

class PrivateMemberReads {
  #byClass = new WeakMap()

  add(name, node, { owner, isStatic }) {
    if (owner) this.#readsFor(owner).add(name, node, { isStatic })
  }

  valuesFor(name, { owner, isStatic }) {
    return this.#byClass.get(owner)?.valuesFor(name, { isStatic }) ?? []
  }

  #readsFor(owner) {
    if (!this.#byClass.has(owner)) this.#byClass.set(owner, new MemberReadsByKind())
    return this.#byClass.get(owner)
  }
}

class MemberReadsByKind {
  #instance = new NamedMemberReads()
  #static = new NamedMemberReads()

  add(name, node, { isStatic }) {
    this.#readsFor(isStatic).add(name, node)
  }

  valuesFor(name, { isStatic }) {
    return this.#readsFor(isStatic).valuesFor(name)
  }

  #readsFor(isStatic) {
    return isStatic ? this.#static : this.#instance
  }
}

class PrivateMemberKinds {
  #byClass = new WeakMap()

  isStatic(name, owner) {
    return this.#kindsFor(owner).get(name)
  }

  #kindsFor(owner) {
    if (!this.#byClass.has(owner)) {
      this.#byClass.set(owner, new Map(owner.body.body
        .filter((member) => member.key?.type === "PrivateIdentifier")
        .map((member) => [ member.key.name, member.static ])))
    }
    return this.#byClass.get(owner)
  }
}

class PublicMemberReads {
  #instance
  #static

  constructor(hierarchy) {
    this.#instance = new OrderedNamedMemberReads(hierarchy)
    this.#static = new OrderedNamedMemberReads(hierarchy)
  }

  add(name, node, { owner, isStatic }) {
    this.#readsFor(isStatic).add(name, node, owner)
  }

  valuesFor(name, { owner, isStatic }) {
    return this.#readsFor(isStatic).valuesFor(name, owner)
  }

  #readsFor(isStatic) {
    return isStatic ? this.#static : this.#instance
  }
}

class OrderedNamedMemberReads {
  #all = new NamedMemberReads()
  #byClass = new WeakMap()
  #byName = new Map()
  #hierarchy

  constructor(hierarchy) {
    this.#hierarchy = hierarchy
  }

  add(name, node, owner) {
    this.#all.add(name, node)
    this.#readsFor(owner).add(name, node)
    this.#orderedFor(name).add(node, this.#hierarchy.positionOf(owner))
  }

  valuesFor(name, owner) {
    const range = this.#hierarchy.rangeOf(owner)
    if (!range || this.#hierarchy.isAmbiguous(owner)) return this.#all.valuesFor(name)

    return [
      ...this.#orderedFor(name).valuesInside(range),
      ...this.#unnamedValuesInside(range, name),
      ...this.#hierarchy.ancestorsOf(owner)
        .flatMap((classNode) => this.#byClass.get(classNode)?.valuesFor(name) ?? [])
    ]
  }

  #readsFor(owner) {
    if (!this.#byClass.has(owner)) this.#byClass.set(owner, new NamedMemberReads())
    return this.#byClass.get(owner)
  }

  #orderedFor(name) {
    if (!this.#byName.has(name)) this.#byName.set(name, new OrderedMemberReads())
    return this.#byName.get(name)
  }

  #unnamedValuesInside(range, name) {
    return name === null ? [] : this.#orderedFor(null).valuesInside(range)
  }
}

class OrderedMemberReads {
  #entries = []
  #sorted

  add(node, position) {
    this.#entries.push({ node, position })
  }

  valuesInside({ start, end }) {
    return this.#values.slice(this.#indexAt(start), this.#indexAt(end)).map((entry) => entry.node)
  }

  get #values() {
    return this.#sorted ??= this.#entries.toSorted((left, right) => left.position - right.position)
  }

  #indexAt(position) {
    return bounds.ge(this.#values, position, byReadPosition)
  }
}

function byReadPosition(entry, position) {
  return entry.position - position
}

class MemberReadKey {
  #key

  constructor(member) {
    this.#key = staticMemberKeyOf(member)
  }

  get name() {
    return this.#key?.name ?? null
  }

  get isPrivate() {
    return this.#key?.node.type === "PrivateIdentifier"
  }
}

class MemberReadLocation {
  #bindings
  #hierarchy
  #key
  #node
  #privateKinds
  #resolver
  #cachedOwner

  constructor(node, { bindings, hierarchy, privateKinds, resolver }) {
    this.#bindings = bindings
    this.#hierarchy = hierarchy
    this.#key = new MemberReadKey(node)
    this.#node = node
    this.#privateKinds = privateKinds
    this.#resolver = resolver
  }

  get isDynamic() {
    return !this.isPrivate && !this.owner
  }

  get isPrivate() {
    return this.#key.isPrivate
  }

  get owner() {
    return this.#cachedOwner ??= this.isPrivate
      ? classDeclaringPrivate(this.#node.property)
      : this.#receiverOwner
  }

  get isUnplaced() {
    return !this.isPrivate && Boolean(this.owner) && this.#hierarchy.isAmbiguous(this.owner)
  }

  get isStatic() {
    return this.isPrivate
      ? this.#privateKinds.isStatic(this.name, this.owner)
      : !this.#bindings.instanceClassOf(this.#receiver)
  }

  get name() {
    return this.#key.name
  }

  get #receiverOwner() {
    if (this.#receiver.type === "ThisExpression") return this.#bindings.classOf(this.#receiver)
    return this.#receiver.type === "Identifier" ? this.#resolver.classFor(this.#receiver) : null
  }

  get #receiver() {
    return this.#node.object
  }
}
