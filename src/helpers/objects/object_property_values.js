import { resolvedPublicMemberNameOf } from "#helpers/classes/resolved_member_key"
import { PropertySourceValue } from "#helpers/objects/property_source_value"

const NO_OBJECT_PROPERTY = Symbol("no object property")

export class ObjectPropertyValues {
  #bindings
  #shapes = new WeakMap()
  #writes

  constructor(bindings, writes) {
    this.#bindings = bindings
    this.#writes = writes
  }

  valueIn(object, name, at) {
    const property = this.#propertyIn(object, name, at)
    return property === NO_OBJECT_PROPERTY ? null : property
  }

  #propertyIn(object, name, at) {
    const written = this.#writes.valueBefore(object, name, at)
    return this.#writes.isNoWrite(written) ? this.#shapeOf(object).propertyNamed(name) : written
  }

  #shapeOf(object) {
    if (!this.#shapes.has(object)) {
      this.#shapes.set(object, new ObjectShape(object, {
        bindings: this.#bindings,
        propertyIn: (source, name, at) => this.#propertyIn(source, name, at)
      }))
    }
    return this.#shapes.get(object)
  }
}

class ObjectShape {
  #bindings
  #object
  #properties = new Map()
  #propertyIn

  constructor(object, { bindings, propertyIn }) {
    this.#object = object
    this.#bindings = bindings
    this.#propertyIn = propertyIn
  }

  propertyNamed(name) {
    if (!this.#properties.has(name)) this.#properties.set(name, this.#uncachedPropertyNamed(name))
    return this.#properties.get(name)
  }

  #uncachedPropertyNamed(name) {
    const { properties } = this.#object
    for (const property of properties.toReversed()) {
      const { value } = new ObjectPropertyMatch(property, name, {
        bindings: this.#bindings,
        propertyIn: this.#propertyIn
      })
      if (value !== NO_OBJECT_PROPERTY) return value
    }
    return NO_OBJECT_PROPERTY
  }
}

class ObjectPropertyMatch {
  #bindings
  #name
  #property
  #propertyIn

  constructor(property, name, { bindings, propertyIn }) {
    this.#property = property
    this.#name = name
    this.#bindings = bindings
    this.#propertyIn = propertyIn
  }

  get value() {
    if (this.#property.type === "SpreadElement") return this.#spreadValue

    const propertyName = resolvedPublicMemberNameOf(this.#property, this.#bindings)
    if (propertyName === null) return null
    if (propertyName !== this.#name) return NO_OBJECT_PROPERTY
    return this.#property.kind === "init" && !this.#property.method ? this.#property.value : null
  }

  get #spreadValue() {
    const source = new PropertySourceValue(this.#property.argument, this.#bindings, { requiresUnexposedObject: true })
    if (source.node?.type === "ObjectExpression") return this.#propertyIn(source.node, this.#name, this.#property)

    return source.hasNoEnumerableOwnProperties || source.hasOnlyIndexedEnumerableProperties
      ? NO_OBJECT_PROPERTY
      : null
  }
}
