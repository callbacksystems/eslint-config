import { TypedArrayIntrinsicPath } from "#helpers/arrays/typed_array_intrinsic_path"
import {
  iteratorPrototypeIntrinsicNameFrom,
  iteratorResultIntrinsicNameOf
} from "#helpers/arrays/iterator_intrinsic_path"
import { resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { DestructuredBindingPath } from "#helpers/scope/destructured_binding_path"

const PATH_PRESENT = Symbol("path present")
const PATHS_BY_SOURCE = new WeakMap()

export class GlobalPath {
  static writePathsFor(member, bindings, targets = [ member.object ]) {
    if (member.optional) return []

    const name = pathMemberOf(resolvedMemberKeyOf(member, bindings))
    return uniquePaths(targets.flatMap((target) => this.mutationTargetPathsFor(target, bindings))
      .map((path) => path.extending(name === "__proto__" ? null : name).normalized))
  }

  static mutationTargetPathsFor(node, bindings) {
    const path = this.from(node, bindings)
    return uniquePaths([ path, new IntrinsicArrayConstructorTarget(node, bindings, path).path ].filter(Boolean))
  }

  static from(node, bindings, seen = null) {
    return seen ? new GlobalPathWalk(node, bindings, seen).value : cachedPathFor(node, bindings)
  }

  constructor(globalName, members = [], pathGuards = []) {
    this.globalName = globalName
    this.members = members
    this.pathGuards = pathGuards
  }

  equals(globalName, members) {
    return this.globalName === globalName && sameValues(this.members, members)
  }

  extending(member, pathGuards = []) {
    return new GlobalPath(this.globalName, [ ...this.members, member ], [ ...this.pathGuards, ...pathGuards ])
  }

  get normalized() {
    if (this.globalName === "globalThis" && isGlobalName(this.members[0])) {
      return new GlobalPath(this.members[0], this.members.slice(1), this.pathGuards)
    }

    const iteratorPrototype = this.members.length === 1 && this.members[0] === "__proto__"
      ? iteratorPrototypeIntrinsicNameFrom(new GlobalPath(this.globalName))
      : null
    return iteratorPrototype ? new GlobalPath(iteratorPrototype, [], this.pathGuards) : this
  }
}

function pathMemberOf(resolvedKey) {
  return resolvedKey?.pathMember ?? resolvedKey?.name ?? null
}

function uniquePaths(paths) {
  const seen = new StructuralPathSet()
  return paths.filter((path) => {
    if (seen.has(path)) return false

    seen.add(path)
    return true
  })
}

class StructuralPathSet {
  #root = new Map()

  add(path) {
    this.#leafFor(path).set(PATH_PRESENT, true)
  }

  has(path) {
    return this.#leafFor(path).has(PATH_PRESENT)
  }

  #leafFor(path) {
    return [ path.globalName, ...path.members ].reduce((node, member) => {
      if (!node.has(member)) node.set(member, new Map())
      return node.get(member)
    }, this.#root)
  }
}

class IntrinsicArrayConstructorTarget {
  #bindings
  #globalPath
  #node

  constructor(node, bindings, globalPath) {
    this.#node = node
    this.#bindings = bindings
    this.#globalPath = globalPath
  }

  get path() {
    if (this.#globalPath) {
      return this.#globalPath.equals("Array", [ "prototype", "constructor" ])
        ? new GlobalPath("Array")
        : null
    }
    return this.#isFreshArrayConstructorRead ? new GlobalPath("Array") : null
  }

  get #isFreshArrayConstructorRead() {
    const value = this.#value
    return value?.type === "MemberExpression" && !value.optional
      && value.object.type === "ArrayExpression"
      && pathMemberOf(resolvedMemberKeyOf(value, this.#bindings)) === "constructor"
  }

  get #value() {
    return this.#node?.type === "Identifier" ? this.#bindings.stableValueFor(this.#node) : this.#node
  }
}

class GlobalPathWalk {
  #operations
  #values = []

  constructor(node, bindings, seen) {
    this.bindings = bindings
    this.#operations = [ new ResolvePath(node, seen) ]
  }

  get value() {
    while (this.#operations.length > 0) this.#operations.pop().performOn(this)
    return this.#values.pop() ?? null
  }

  resolve(node, seen) {
    this.#operations.push(new ResolvePath(node, seen))
  }

  schedule(operation) {
    this.#operations.push(operation)
  }

  takeValue() {
    return this.#values.pop() ?? null
  }

  addValue(value) {
    this.#values.push(value)
  }
}

class ResolvePath {
  #node
  #seen

  constructor(node, seen) {
    this.#node = node
    this.#seen = seen
  }

  performOn(walk) {
    const iteratorResult = iteratorResultIntrinsicNameOf(this.#node, walk.bindings)
    if (iteratorResult) walk.addValue(new GlobalPath(iteratorResult))
    else if (this.#isPrototypeIntrinsicCandidate(walk.bindings)) this.#resolvePrototypeIntrinsicOn(walk)
    else if (this.#node?.type === "Identifier") this.#resolveIdentifierOn(walk)
    else if (this.#node?.type === "MemberExpression") this.#resolveMemberOn(walk)
    else walk.addValue(null)
  }

  #isPrototypeIntrinsicCandidate(bindings) {
    if (this.#node?.type !== "CallExpression" || !hasPlainFirstArgument(this.#node)) return false

    const { callee } = this.#node
    return callee.type === "Identifier"
      || (callee.type === "MemberExpression"
        && pathMemberOf(resolvedMemberKeyOf(callee, bindings)) === "getPrototypeOf")
  }

  #resolvePrototypeIntrinsicOn(walk) {
    walk.schedule(new ResolvePrototypeIntrinsic(this.#node, this.#seen))
    walk.resolve(this.#node.callee, new Set(this.#seen))
  }

  #resolveIdentifierOn(walk) {
    const globalName = walk.bindings.globalNameFor(this.#node)
    if (globalName) walk.addValue(new GlobalPath(globalName))
    else this.#resolveBoundIdentifierOn(walk)
  }

  #resolveBoundIdentifierOn(walk) {
    const variable = walk.bindings.variableFor(this.#node)
    if (!variable || this.#seen.has(variable)) return walk.addValue(null)

    this.#seen.add(variable)
    const destructured = new DestructuredBindingPath(this.#node, walk.bindings).value
    if (destructured) {
      walk.schedule(new ExtendPath(destructured.members))
      walk.resolve(destructured.root, this.#seen)
    } else {
      walk.resolve(walk.bindings.stableValueFor(this.#node), this.#seen)
    }
  }

  #resolveMemberOn(walk) {
    const key = resolvedMemberKeyOf(this.#node, walk.bindings)
    const member = pathMemberOf(key)
    if (member === null) return walk.addValue(null)

    walk.schedule(new ExtendPath([ member ], key.pathGuards))
    walk.resolve(this.#node.object, this.#seen)
  }
}

function hasPlainFirstArgument(node) {
  return Boolean(node.arguments[0]) && node.arguments[0].type !== "SpreadElement"
}

class ResolvePrototypeIntrinsic {
  #node
  #seen

  constructor(node, seen) {
    this.#node = node
    this.#seen = seen
  }

  performOn(walk) {
    const callee = walk.takeValue()
    if (TypedArrayIntrinsicPath.isPrototypeLookup(callee)) {
      walk.schedule(new FinishPrototypeIntrinsic(callee))
      walk.resolve(this.#node.arguments[0], new Set(this.#seen))
    } else {
      walk.addValue(null)
    }
  }
}

class FinishPrototypeIntrinsic {
  #callee

  constructor(callee) {
    this.#callee = callee
  }

  performOn(walk) {
    const argument = walk.takeValue()
    const typedArray = new TypedArrayIntrinsicPath(this.#callee, argument).value
    const iterator = iteratorPrototypeIntrinsicNameFrom(argument)
    if (typedArray) walk.addValue(new GlobalPath(typedArray.globalName, typedArray.members))
    else walk.addValue(iterator ? new GlobalPath(iterator) : null)
  }
}

class ExtendPath {
  #members
  #pathGuards

  constructor(members, pathGuards = []) {
    this.#members = members
    this.#pathGuards = pathGuards
  }

  performOn(walk) {
    const path = this.#members.reduce((current, member) => current?.extending(member) ?? null, walk.takeValue())
    walk.addValue(path
      ? new GlobalPath(path.globalName, path.members, [ ...path.pathGuards, ...this.#pathGuards ]).normalized
      : null)
  }
}

function cachedPathFor(node, bindings) {
  const { sourceCode } = bindings
  if (!sourceCode || !node) return new GlobalPathWalk(node, bindings, new Set()).value

  if (!PATHS_BY_SOURCE.has(sourceCode)) PATHS_BY_SOURCE.set(sourceCode, new WeakMap())
  const paths = PATHS_BY_SOURCE.get(sourceCode)
  if (!paths.has(node)) paths.set(node, new GlobalPathWalk(node, bindings, new Set()).value)
  return paths.get(node)
}

function sameValues(first, second) {
  return first.length === second.length && first.every((value, index) => value === second[index])
}

function isGlobalName(member) {
  return member === null || typeof member === "string"
}
