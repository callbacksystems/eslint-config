// Public and private members differ under reflection. Track exact instance-`this` observations so own-property
// operations protect fields without needlessly protecting prototype methods, while name-based access protects both.

import { CallArguments } from "#helpers/functions/call_arguments"
import { isThisMember, staticAccessKeyOf, staticMemberKeyOf } from "#helpers/syntax/classes"

const OWN_PROPERTY_INTROSPECTION = new Set([ "hasOwnProperty", "propertyIsEnumerable" ])
const ALL_PROPERTY_INTROSPECTION = new Set([
  "__lookupGetter__", "__lookupSetter__", "__defineGetter__", "__defineSetter__"
])
const OWN_NAMED_INTROSPECTIONS = new Set([
  "Object.hasOwn", "Object.getOwnPropertyDescriptor", "Reflect.getOwnPropertyDescriptor"
])
const ALL_NAMED_INTROSPECTIONS = new Set([
  "Object.defineProperty", "Reflect.has", "Reflect.get", "Reflect.set", "Reflect.deleteProperty",
  "Reflect.defineProperty"
])
const OWN_ENUMERATIONS = new Set([
  "Object.getOwnPropertyNames", "Object.getOwnPropertySymbols", "Object.getOwnPropertyDescriptors", "Object.keys",
  "Object.values", "Object.entries", "Object.freeze", "Object.seal", "Object.preventExtensions",
  "Object.isExtensible", "Object.isFrozen", "Object.isSealed", "Reflect.ownKeys", "JSON.stringify"
])
const ALL_INTROSPECTIONS = new Set([
  "Object.defineProperties", "Object.getPrototypeOf", "Object.setPrototypeOf",
  "Reflect.getPrototypeOf", "Reflect.setPrototypeOf"
])
const DIRECT_THIS_OBSERVATIONS = {
  BinaryExpression: (node) => node.parent.operator === "in" && node.parent.right === node
    ? new Introspection("all", staticNameOf(node.parent.left))
    : null,
  ForInStatement: (node) => node.parent.right === node ? new Introspection("own", null) : null,
  SpreadElement: (node) => node.parent.parent.type === "ObjectExpression" ? new Introspection("own", null) : null
}

export class PrivateMemberIntrospection {
  #allNames = new Set()
  #hasDynamicAll = false
  #hasDynamicOwn = false
  #ownNames = new Set()

  constructor(expressions, { view, classNode, bindings }) {
    expressions.filter((node) => view.isInstanceThisOf(node, classNode))
      .forEach((node) => this.#add(new ThisObservation(node, bindings).value))
  }

  reads(name, { hasOwnDefinition }) {
    return this.#readsAll(name) ? true : hasOwnDefinition && this.#readsOwn(name)
  }

  #add(observation) {
    if (observation?.kind === "all") this.#addAll(observation.name)
    else if (observation?.kind === "own") this.#addOwn(observation.name)
  }

  #addAll(name) {
    if (name === null) this.#hasDynamicAll = true
    else this.#allNames.add(name)
  }

  #addOwn(name) {
    if (name === null) this.#hasDynamicOwn = true
    else this.#ownNames.add(name)
  }

  #readsAll(name) {
    return this.#hasDynamicAll || this.#allNames.has(name)
  }

  #readsOwn(name) {
    return this.#hasDynamicOwn || this.#ownNames.has(name)
  }
}

class Introspection {
  constructor(kind, name) {
    this.kind = kind
    this.name = name
  }
}

function staticNameOf(node) {
  return staticMemberKeyOf({ computed: true, key: node })?.name ?? null
}

class ThisObservation {
  #node
  #bindings

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
  }

  get value() {
    return this.#memberValue ?? this.#directValue ?? new StaticIntrospection(this.#node, this.#bindings).value
  }

  get #memberValue() {
    return isThisMember(this.#node.parent) ? new ThisMemberObservation(this.#node.parent).value : null
  }

  get #directValue() {
    return DIRECT_THIS_OBSERVATIONS[this.#node.parent.type]?.(this.#node) ?? null
  }
}

class StaticIntrospection {
  #thisExpression
  #bindings
  #cachedInvocation
  #cachedPosition
  #cachedSignature

  constructor(thisExpression, bindings) {
    this.#thisExpression = thisExpression
    this.#bindings = bindings
  }

  get value() {
    if (this.#signature === "Object.assign") return this.#assignValue
    if (this.#position !== 0) return null
    if (OWN_NAMED_INTROSPECTIONS.has(this.#signature)) return this.#named("own")
    if (ALL_NAMED_INTROSPECTIONS.has(this.#signature)) return this.#named("all")
    if (OWN_ENUMERATIONS.has(this.#signature)) return new Introspection("own", null)
    return ALL_INTROSPECTIONS.has(this.#signature) ? new Introspection("all", null) : null
  }

  get #signature() {
    return this.#cachedSignature ??= new StaticCallSignature(this.#invocation, this.#bindings).value
  }

  get #invocation() {
    return this.#cachedInvocation ??= this.#thisExpression.parent.type === "CallExpression"
      ? this.#thisExpression.parent
      : null
  }

  get #assignValue() {
    return this.#position === 0 ? new Introspection("all", null) : new Introspection("own", null)
  }

  get #position() {
    return this.#cachedPosition ??= this.#invocation
      ? new CallArguments(this.#invocation).positionOf(this.#thisExpression)
      : -1
  }

  #named(kind) {
    return new Introspection(kind, staticArgumentNameAt(this.#invocation, 1))
  }
}

class StaticCallSignature {
  #call
  #bindings

  constructor(call, bindings) {
    this.#call = call
    this.#bindings = bindings
  }

  get value() {
    return this.#isKnownGlobalMember ? `${this.#callee.object.name}.${staticAccessKeyOf(this.#callee).name}` : ""
  }

  get #isKnownGlobalMember() {
    return [
      this.#callee,
      this.#callee?.object.type === "Identifier",
      this.#callee ? this.#bindings.isUnmodifiedGlobal(this.#callee.object) : false,
      staticAccessKeyOf(this.#callee)
    ].every(Boolean)
  }

  get #callee() {
    return this.#call?.callee.type === "MemberExpression" ? this.#call.callee : null
  }
}

function staticArgumentNameAt(call, position) {
  const argument = call.arguments[position]
  return argument ? staticArgumentNameOf(argument) : "undefined"
}

function staticArgumentNameOf(argument) {
  return argument.type === "SpreadElement" ? null : staticNameOf(argument)
}

class ThisMemberObservation {
  #member

  constructor(member) {
    this.#member = member
  }

  get value() {
    return this.#isDynamic ? new Introspection("all", null) : this.#deleteValue ?? this.#ownValue
  }

  get #isDynamic() {
    return this.#member.computed && !staticAccessKeyOf(this.#member)
  }

  get #deleteValue() {
    return this.#isDeleted
      ? new Introspection("all", staticAccessKeyOf(this.#member)?.name ?? null)
      : null
  }

  get #isDeleted() {
    return [
      this.#consumer.type === "UnaryExpression",
      this.#consumer.operator === "delete",
      this.#consumer.argument === this.#deletionTarget
    ].every(Boolean)
  }

  get #consumer() {
    return this.#member.parent.type === "ChainExpression" ? this.#member.parent.parent : this.#member.parent
  }

  get #deletionTarget() {
    return this.#member.parent.type === "ChainExpression" ? this.#member.parent : this.#member
  }

  get #ownValue() {
    const introspection = new OwnPropertyIntrospection(this.#member)
    return introspection.isPresent ? new Introspection(introspection.kind, introspection.name) : null
  }
}

class OwnPropertyIntrospection {
  #member

  constructor(member) {
    this.#member = member
  }

  get isPresent() {
    return this.#isDirectInvocation && this.#isKnownMethod
  }

  get name() {
    return staticArgumentNameAt(this.#invocation, 0)
  }

  get kind() {
    return OWN_PROPERTY_INTROSPECTION.has(this.#methodName) ? "own" : "all"
  }

  get #isDirectInvocation() {
    return Boolean(this.#invocation) && this.#invocation.callee === this.#member
  }

  get #invocation() {
    return this.#member.parent?.type === "CallExpression" ? this.#member.parent : null
  }

  get #isKnownMethod() {
    return OWN_PROPERTY_INTROSPECTION.has(this.#methodName) || ALL_PROPERTY_INTROSPECTION.has(this.#methodName)
  }

  get #methodName() {
    return staticAccessKeyOf(this.#member)?.name
  }
}
