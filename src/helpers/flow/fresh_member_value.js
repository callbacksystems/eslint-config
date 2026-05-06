import { resolvedRuntimePropertyKeyOf } from "#helpers/classes/resolved_member_key"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"

const UNKNOWN = "unknown"
const arrayIndexes = new WeakMap()
const objectIndexes = new WeakMap()

export class FreshMemberValue {
  #access
  #bindings
  #container

  constructor(container, { access, bindings }) {
    this.#container = container
    this.#access = access
    this.#bindings = bindings
  }

  get value() {
    if (this.#container.type === "ObjectExpression") return this.#objectValue
    if (this.#container.type === "ArrayExpression") return this.#arrayValue
    return UNKNOWN
  }

  get #objectValue() {
    return objectIndexFor(this.#container, this.#bindings).valueAt(this.#access.name)
  }

  get #arrayValue() {
    return arrayIndexFor(this.#container).valueAt(this.#access.arrayIndex)
  }
}

function objectIndexFor(object, bindings) {
  if (!objectIndexes.has(object)) objectIndexes.set(object, new ObjectMemberIndex(object, bindings))
  return objectIndexes.get(object)
}

class ObjectMemberIndex {
  #bindings
  #globals
  #hasUncertainSuffix = false
  #values = new Map()

  constructor(object, bindings) {
    this.#bindings = bindings
    this.#globals = new GlobalValueIdentity(bindings)
    object.properties.toReversed().forEach((property) => this.#add(property))
  }

  valueAt(name) {
    return name === null ? UNKNOWN : this.#values.get(name) ?? UNKNOWN
  }

  #add(property) {
    const candidate = new ObjectPropertyValue(property, { bindings: this.#bindings, globals: this.#globals })
    if (candidate.name === null) this.#hasUncertainSuffix = true
    else if (!this.#values.has(candidate.name)) this.#values.set(candidate.name, this.#valueOf(candidate))
  }

  #valueOf(candidate) {
    return this.#hasUncertainSuffix ? UNKNOWN : candidate.value
  }
}

class ObjectPropertyValue {
  #bindings
  #globals
  #property

  constructor(property, { bindings, globals }) {
    this.#property = property
    this.#bindings = bindings
    this.#globals = globals
  }

  get name() {
    return this.#property.type === "Property"
      ? resolvedRuntimePropertyKeyOf(this.#property, { bindings: this.#bindings, globals: this.#globals })
      : null
  }

  get value() {
    return this.#property.kind === "init" ? this.#property.value : UNKNOWN
  }
}

function arrayIndexFor(array) {
  if (!arrayIndexes.has(array)) arrayIndexes.set(array, new ArrayMemberIndex(array))
  return arrayIndexes.get(array)
}

class ArrayMemberIndex {
  #elements
  #firstSpread

  constructor(array) {
    this.#elements = array.elements
    this.#firstSpread = array.elements.findIndex((element) => element?.type === "SpreadElement")
  }

  valueAt(index) {
    return this.#isKnown(index) ? this.#elements[index] ?? UNKNOWN : UNKNOWN
  }

  #isKnown(index) {
    return index !== null && (this.#firstSpread === -1 || index < this.#firstSpread)
  }
}
