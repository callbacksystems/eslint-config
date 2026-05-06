import { PropertySourceValue } from "#helpers/objects/property_source_value"
import { ResolvedObjectProperty } from "#helpers/objects/resolved_object_property"

export class LiteralHeaderInitializer {
  members = []
  objects = []

  #arrays
  #at
  #nodes
  #objectShapes
  #seenObjects = new WeakSet()

  constructor(node, { at, nodes }) {
    this.#at = at
    this.#nodes = nodes
    this.#objectShapes = new HeaderObjectShapes(nodes, (object) => this.#rememberObject(object))
    this.#arrays = new HeaderArrayEntries(nodes, (object) => this.#rememberObject(object))
    this.#nodes.resolvedValuesOf(node, at).forEach((value) => this.#include(value))
  }

  #rememberObject(object) {
    if (!this.#seenObjects.has(object)) {
      this.#seenObjects.add(object)
      this.objects.push(object)
    }
  }

  #include(value) {
    if (value?.type === "ObjectExpression") {
      this.members.push(...this.#objectShapes.shapeOf(value, this.#at).members)
    } else if (value?.type === "ArrayExpression") {
      this.members.push(...this.#arrays.entriesIn(value, this.#at))
    }
  }
}

class HeaderObjectShapes {
  #nodes
  #rememberObject
  #shapes = new WeakMap()

  constructor(nodes, rememberObject) {
    this.#nodes = nodes
    this.#rememberObject = rememberObject
  }

  shapeOf(object, at) {
    this.#rememberObject(object)
    const shapes = valuesAt(this.#shapes, object)
    if (!shapes.has(at)) {
      const shape = new HeaderObjectShape(object, at, {
        nodes: this.#nodes,
        shapeOf: (source, position) => this.shapeOf(source, position)
      })
      shapes.set(at, shape)
      shape.build()
    }
    return shapes.get(at)
  }
}

function valuesAt(cache, object) {
  if (!cache.has(object)) cache.set(object, new WeakMap())
  return cache.get(object)
}

class HeaderObjectShape {
  #at
  #entries = new Map()
  #isUnknown = false
  #nodes
  #object
  #shapeOf

  constructor(object, at, { nodes, shapeOf }) {
    this.#object = object
    this.#at = at
    this.#nodes = nodes
    this.#shapeOf = shapeOf
  }

  build() {
    if (this.#nodes.hasWritesBefore(this.#object, this.#at)) this.#forgetAll()
    else this.#object.properties.forEach((property) => this.#add(property))
  }

  get members() {
    return Array.from(this.#entries.values())
  }

  applyTo(target) {
    if (this.#isUnknown) target.#forgetAll()
    this.#entries.forEach((member, name) => target.#entries.set(name, member))
  }

  #forgetAll() {
    this.#isUnknown = true
    this.#entries.clear()
  }

  #add(property) {
    if (property.type === "SpreadElement") this.#addSpread(property)
    else this.#addProperty(property)
  }

  #addSpread(property) {
    const sources = this.#nodes.resolvedValuesOf(property.argument, property)
    const [ source ] = sources
    if (sources.length !== 1) this.#forgetAll()
    else if (source?.type === "ObjectExpression") this.#shapeOf(source, property).applyTo(this)
    else if (!hasNoNamedProperties(source, this.#nodes.bindings)) this.#forgetAll()
  }

  #addProperty(property) {
    const entry = new ResolvedObjectProperty(property, { bindings: this.#nodes.bindings, isKeyValid: Boolean })
    if (entry.isPrototypeSetter) return

    if (entry.writeName === null) this.#forgetAll()
    else this.#entries.set(entry.writeName, property)
  }
}

function hasNoNamedProperties(node, bindings) {
  const source = new PropertySourceValue(node, bindings)
  return source.hasNoEnumerableOwnProperties || source.hasOnlyIndexedEnumerableProperties
}

class HeaderArrayEntries {
  #entries = new WeakMap()
  #nodes
  #rememberObject

  constructor(nodes, rememberObject) {
    this.#nodes = nodes
    this.#rememberObject = rememberObject
  }

  entriesIn(array, at) {
    this.#rememberObject(array)
    const entries = valuesAt(this.#entries, array)
    if (!entries.has(at)) {
      const values = new Set()
      entries.set(at, values)
      if (!this.#nodes.hasWritesBefore(array, at)) this.#addElements(array, values)
    }
    return entries.get(at)
  }

  #addElements(array, entries) {
    array.elements.forEach((element) => {
      if (element?.type === "SpreadElement") this.#addSpread(element, entries)
      else if (element?.type === "ArrayExpression") entries.add(element)
    })
  }

  #addSpread(element, entries) {
    this.#nodes.resolvedValuesOf(element.argument, element)
      .filter((value) => value?.type === "ArrayExpression")
      .forEach((array) => this.entriesIn(array, element).forEach((entry) => entries.add(entry)))
  }
}
