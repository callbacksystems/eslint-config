import bounds from "binary-search-bounds"
import { isFunction } from "#helpers/syntax/functions"
import { byStartPosition } from "#helpers/syntax/sorting"
import { ClassMemberHierarchy } from "#helpers/classes/class_member_hierarchy"
import { ClassMemberMap } from "#helpers/classes/class_member_map"
import { isResolvedMemberKeyValid, resolvedRuntimeMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"

const ABSENT_MEMBER = { functionNode: null, isAbsent: true, isUnknown: false }
const UNKNOWN_MEMBER = { functionNode: null, isAbsent: false, isUnknown: true }

export class ClassMemberResolver {
  static #membersByClass = new WeakMap()

  #bindings
  #globals
  #hierarchy

  constructor(bindings) {
    this.#bindings = bindings
    this.#globals = new GlobalValueIdentity(bindings)
    this.#hierarchy = new ClassMemberHierarchy((classNode) => this.#membersOf(classNode))
  }

  resolutionInHierarchy(classNode, property, { before = null, isStatic, kind, superclassOf }) {
    return isResolvedMemberKeyValid(property, this.#globals)
      ? this.#hierarchy.resolutionFor(classNode, {
        before,
        kind,
        superclassOf,
        key: new ClassMemberKey(property, isStatic)
      })
      : UNKNOWN_MEMBER
  }

  ownResolutionFor(classNode, property, { before = null, isStatic, kind }) {
    return isResolvedMemberKeyValid(property, this.#globals)
      ? this.#membersOf(classNode).resolutionFor(new ClassMemberKey(property, isStatic), kind, { before })
      : UNKNOWN_MEMBER
  }

  #membersOf(classNode) {
    if (!ClassMemberResolver.#membersByClass.has(classNode)) {
      ClassMemberResolver.#membersByClass.set(classNode,
        new ClassMembers(classNode, { bindings: this.#bindings, globals: this.#globals }))
    }
    return ClassMemberResolver.#membersByClass.get(classNode)
  }
}

class ClassMemberKey {
  #property

  constructor(property, isStatic) {
    this.#property = property
    this.isStatic = isStatic
  }

  get classKind() {
    return this.isStatic ? "static" : "instance"
  }

  get isPrivate() {
    return this.#property.kind === "private" || this.#property.node?.type === "PrivateIdentifier"
  }

  get value() {
    return this.#property.pathMember ?? this.#property.name
  }
}

class ClassMembers {
  #bindings
  #records = new ClassMemberRecords()

  constructor(classNode, { bindings, globals }) {
    this.#bindings = bindings
    classNode.body.body.forEach((node) => new ClassMemberDefinition(node, {
      globals, bindings: this.#bindings, records: this.#records
    }).add())
  }

  resolutionFor(key, kind, { before }) {
    return new ClassMemberLookup({
      key,
      kind,
      bindings: this.#bindings,
      position: before?.range[0] ?? Infinity,
      records: this.#records
    }).resolution
  }
}

class ClassMemberRecords {
  getters = new ClassMemberMap()
  methods = new ClassMemberMap()
  setters = new ClassMemberMap()

  #ambiguousFieldStartByKind = new Map()
  #ambiguousMethodKinds = new Set()
  #fieldsByKey = new ClassMemberMap()

  addAmbiguous(node) {
    const kind = classKindOf(node)
    if (node.type === "MethodDefinition") this.#ambiguousMethodKinds.add(kind)
    else {
      const first = this.#ambiguousFieldStartByKind.get(kind) ?? Infinity
      this.#ambiguousFieldStartByKind.set(kind, Math.min(first, node.range[0]))
    }
  }

  addField(key, node) {
    if (!this.#fieldsByKey.has(key)) this.#fieldsByKey.set(key, new FieldDefinitions())
    this.#fieldsByKey.get(key).add(node)
  }

  fieldFor(key, position) {
    return this.#fieldsByKey.get(key)?.valueBefore(position) ?? { isPresent: false, value: null }
  }

  hasAmbiguousBefore(kind, position) {
    return this.#ambiguousMethodKinds.has(kind)
      || (this.#ambiguousFieldStartByKind.get(kind) ?? Infinity) < position
  }
}

function classKindOf(node) {
  return node.static ? "static" : "instance"
}

class FieldDefinitions {
  #nodes = []

  add(node) {
    this.#nodes.push(node)
  }

  valueBefore(position) {
    const start = bounds.ge(this.#nodes, position, byStartPosition)
    return start === 0
      ? { isPresent: false, value: null }
      : { isPresent: true, value: this.#nodes[start - 1].value }
  }
}

class ClassMemberDefinition {
  #bindings
  #globals
  #node
  #records
  #cachedProperty

  constructor(node, { bindings, globals, records }) {
    this.#bindings = bindings
    this.#globals = globals
    this.#node = node
    this.#records = records
  }

  add() {
    if (this.#isMember) {
      if (this.#hasKey) this.#addKnown()
      else this.#records.addAmbiguous(this.#node)
    }
  }

  get #isMember() {
    return this.#isMethod || this.#node.type === "PropertyDefinition"
  }

  get #isMethod() {
    return this.#node.type === "MethodDefinition"
  }

  get #hasKey() {
    return this.#property !== null
  }

  get #property() {
    return this.#cachedProperty ??= resolvedRuntimeMemberKeyOf(this.#node, {
      bindings: this.#bindings, globals: this.#globals
    })
  }

  #addKnown() {
    if (this.#isMethod) this.#addMethod()
    else this.#records.addField(this.#key, this.#node)
  }

  #addMethod() {
    this.#records.methods.set(this.#key, this.#callableValue)
    if (this.#isGetter) this.#records.getters.set(this.#key, this.#value)
    else if (this.#replacesGetter || !this.#records.getters.has(this.#key)) this.#records.getters.set(this.#key, null)
    if (this.#isSetter) this.#records.setters.set(this.#key, this.#value)
    else if (this.#replacesSetter || !this.#records.setters.has(this.#key)) this.#records.setters.set(this.#key, null)
  }

  get #key() {
    return new ClassMemberKey(this.#property, this.#node.static)
  }

  get #callableValue() {
    return this.#node.kind === "method" ? this.#value : null
  }

  get #value() {
    return this.#node.value
  }

  get #isGetter() {
    return this.#node.kind === "get"
  }

  get #replacesGetter() {
    return this.#node.kind !== "set"
  }

  get #isSetter() {
    return this.#node.kind === "set"
  }

  get #replacesSetter() {
    return this.#node.kind !== "get"
  }
}

class ClassMemberLookup {
  #bindings
  #key
  #kind
  #position
  #records

  constructor({ bindings, key, kind, position, records }) {
    this.#bindings = bindings
    this.#key = key
    this.#kind = kind
    this.#position = position
    this.#records = records
  }

  get resolution() {
    return this.#isAmbiguous ? UNKNOWN_MEMBER : this.#knownResolution
  }

  get #isAmbiguous() {
    return !this.#key.isPrivate && this.#records.hasAmbiguousBefore(this.#key.classKind, this.#position)
  }

  get #knownResolution() {
    const field = this.#records.fieldFor(this.#key, this.#position)
    if (field.isPresent) return this.#knownMember(this.#kind === "function" ? field.value : null)
    return this.#kind === "data" ? this.#dataResolution : this.#methodResolution
  }

  #knownMember(value) {
    const functionNode = isFunction(value) ? value : this.#identifierFunctionFor(value)
    return { functionNode, isAbsent: false, isUnknown: false }
  }

  #identifierFunctionFor(value) {
    return value?.type === "Identifier" ? this.#bindings.functionFor(value) : null
  }

  get #dataResolution() {
    return isFunction(this.#records.methods.get(this.#key)) ? this.#knownMember(null) : ABSENT_MEMBER
  }

  get #methodResolution() {
    const values = this.#methodValues
    return values.has(this.#key) ? this.#knownMember(values.get(this.#key)) : ABSENT_MEMBER
  }

  get #methodValues() {
    if (this.#kind === "getter") return this.#records.getters
    if (this.#kind === "setter") return this.#records.setters
    return this.#records.methods
  }
}
