import { GlobalPath } from "#helpers/scope/global_path"
import { ResolvedObjectProperty } from "#helpers/objects/resolved_object_property"
import { PropertySourceValue } from "#helpers/objects/property_source_value"
import { staticStringValueOf } from "#helpers/syntax/literals"
import { wellKnownSymbolKeyOf } from "#helpers/syntax/well_known_symbol"

const UNKNOWN_WRITE = { name: null, value: null }

export class PropertyWriteArguments {
  #arguments
  #bindings
  #contract
  #hasDefaultDescriptorPrototype
  #isKeyValid
  #spreadArgumentIndex

  constructor(argumentsList, contract, { bindings, hasDefaultDescriptorPrototype, isKeyValid = Boolean }) {
    this.#arguments = argumentsList
    this.#contract = contract
    this.#bindings = bindings
    this.#hasDefaultDescriptorPrototype = hasDefaultDescriptorPrototype
    this.#isKeyValid = isKeyValid
    this.#spreadArgumentIndex = argumentsList.findIndex(isSpreadElement)
  }

  get values() {
    return this.target && this.#hasEffectiveReceiver
      ? this.#writes.map(({ name, value }) => ({ target: this.target, name, value }))
      : []
  }

  get target() {
    return this.#plainArgumentAt(0)
  }

  hasEffectiveReceiver(node) {
    return this.#contract.memberName === "set" && this.#plainArgumentAt(3) === node && this.#hasEffectiveReceiver
  }

  get #hasEffectiveReceiver() {
    if (this.#contract.memberName !== "set") return true
    if (this.#isIndeterminateAt(3) || this.#arguments.length < 4) return true

    const receiver = this.#plainArgumentAt(3)
    return Boolean(receiver) && new ResolvedValues(this.#bindings).canBeSame(
      this.target, receiver, this.#arguments.slice(1, 3))
  }

  #isIndeterminateAt(index) {
    return this.#spreadArgumentIndex !== -1 && this.#spreadArgumentIndex <= index
  }

  #plainArgumentAt(index) {
    return this.#isIndeterminateAt(index) ? null : this.#arguments[index] ?? null
  }

  get #writes() {
    if (this.#contract.kind === "assign") return this.#assignedPropertyWrites
    if (this.#contract.kind === "descriptors") return this.#definedPropertyWrites
    if (this.#contract.kind === "prototype") return this.#prototypeWrites
    return this.#contract.kind !== "descriptor" || this.#hasReplacingDescriptor ? this.#keyWrites : []
  }

  get #assignedPropertyWrites() {
    return this.#arguments.slice(1)
      .flatMap((source) => new EnumerablePropertyWrites(source, this.#keyOptions).values)
  }

  get #keyOptions() {
    return { bindings: this.#bindings, isKeyValid: this.#isKeyValid }
  }

  get #definedPropertyWrites() {
    const descriptors = this.#plainArgumentAt(1)
    return descriptors
      ? new DefinedPropertyWrites(descriptors, this.#descriptorOptions).values
      : this.#indeterminateWritesAt(1)
  }

  get #descriptorOptions() {
    return {
      bindings: this.#bindings,
      hasDefaultPrototype: this.#hasDefaultDescriptorPrototype,
      isKeyValid: this.#isKeyValid
    }
  }

  #indeterminateWritesAt(index) {
    return this.#isIndeterminateAt(index) ? [ UNKNOWN_WRITE ] : []
  }

  get #prototypeWrites() {
    return this.#plainArgumentAt(1) ? [ UNKNOWN_WRITE ] : this.#indeterminateWritesAt(1)
  }

  get #hasReplacingDescriptor() {
    const descriptor = this.#plainArgumentAt(2)
    return descriptor
      ? new PropertyDescriptor(descriptor, this.#descriptorOptions).canReplaceValue
      : this.#isIndeterminateAt(2)
  }

  get #keyWrites() {
    const key = this.#plainArgumentAt(1)
    return key ? this.#keyWriteFor(key) : this.#indeterminateWritesAt(1)
  }

  #keyWriteFor(key) {
    const name = new ResolvedValues(this.#bindings, this.#isKeyValid).propertyKeyFor(key)
    return [ { name, value: name === null ? null : this.#writtenKeyValue } ]
  }

  get #writtenKeyValue() {
    return this.#contract.kind === "descriptor" ? this.#descriptorWrittenValue : this.#writtenKeyArgument
  }

  get #descriptorWrittenValue() {
    const descriptor = this.#plainArgumentAt(2)
    return descriptor ? new PropertyDescriptor(descriptor, this.#descriptorOptions).writtenValue : null
  }

  get #writtenKeyArgument() {
    return this.#contract.memberName === "set" ? this.#plainArgumentAt(2) : null
  }
}

function isSpreadElement(node) {
  return node?.type === "SpreadElement"
}

class ResolvedValues {
  #bindings
  #isKeyValid

  constructor(bindings, isKeyValid = Boolean) {
    this.#bindings = bindings
    this.#isKeyValid = isKeyValid
  }

  canBeSame(first, second, between = []) {
    const firstValue = this.#valueFor(first)
    const secondValue = this.#valueFor(second)
    return between.every((node) => isStableRead(node, this.#bindings))
      && ((firstValue !== null && (firstValue === secondValue || this.#pathsMatch(firstValue, secondValue)))
        || this.#bindings.sharesBinding(first, second))
  }

  propertyKeyFor(node) {
    const name = staticStringValueOf(this.#valueFor(node))
    if (name !== null) return name

    const key = wellKnownSymbolKeyOf(node, this.#bindings)
    return this.#isKeyValid(key) ? key.pathMember : null
  }

  #valueFor(node) {
    return node?.type === "Identifier" ? this.#bindings.stableValueFor(node) : node
  }

  #pathsMatch(first, second) {
    const firstPath = GlobalPath.from(first, this.#bindings)
    const secondPath = GlobalPath.from(second, this.#bindings)
    return Boolean(firstPath) && Boolean(secondPath)
      && firstPath.equals(secondPath.globalName, secondPath.members)
  }
}

function isStableRead(node, bindings) {
  return node?.type === "Literal"
    || (node?.type === "Identifier" && !bindings.isDynamicallyResolved(node))
    || Boolean(wellKnownSymbolKeyOf(node, bindings))
}

class EnumerablePropertyWrites {
  #keyOptions
  #node
  #source

  constructor(node, keyOptions) {
    this.#keyOptions = keyOptions
    this.#source = new PropertySourceValue(node, keyOptions.bindings, { requiresUnexposedObject: true })
    this.#node = this.#source.node
  }

  get values() {
    if (this.#node.type === "SpreadElement") return [ UNKNOWN_WRITE ]
    if (this.#node.type === "ObjectExpression") return this.#objectWrites
    return this.#source.hasNoEnumerableOwnProperties || this.#source.hasOnlyIndexedEnumerableProperties
      ? []
      : [ UNKNOWN_WRITE ]
  }

  get #objectWrites() {
    return this.#node.properties.flatMap((property) => {
      if (property.type === "SpreadElement") {
        return new EnumerablePropertyWrites(property.argument, this.#keyOptions).values
      }

      const entry = new ResolvedObjectProperty(property, this.#keyOptions)
      return entry.isPrototypeSetter ? [] : [ writeFor(entry) ]
    })
  }
}

function writeFor(entry) {
  const name = entry.writeName
  return { name, value: name === null ? null : entry.writtenValue }
}

class DefinedPropertyWrites {
  #bindings
  #hasDefaultPrototype
  #isKeyValid
  #node
  #source

  constructor(node, options) {
    this.#source = new PropertySourceValue(node, options.bindings, { requiresUnexposedObject: true })
    this.#node = this.#source.node
    this.#bindings = options.bindings
    this.#hasDefaultPrototype = options.hasDefaultPrototype
    this.#isKeyValid = options.isKeyValid
  }

  get values() {
    if (this.#source.isRegExpLiteral) return []
    if (this.#node.type !== "ObjectExpression") return this.#source.isPrimitive ? [] : [ UNKNOWN_WRITE ]
    return this.#node.properties.flatMap((property) => this.#writesFor(property))
  }

  #writesFor(property) {
    if (property.type === "SpreadElement") return new DefinedPropertyWrites(property.argument, this.#options).values

    const entry = new ResolvedObjectProperty(property, { bindings: this.#bindings, isKeyValid: this.#isKeyValid })
    if (entry.isPrototypeSetter) return []

    const name = entry.writeName
    if (name === null) return [ UNKNOWN_WRITE ]
    return this.#doesPropertyReplaceValue(entry)
      ? [ { name, value: this.#writtenValueOf(entry) } ]
      : []
  }

  get #options() {
    return { bindings: this.#bindings, hasDefaultPrototype: this.#hasDefaultPrototype, isKeyValid: this.#isKeyValid }
  }

  #doesPropertyReplaceValue(entry) {
    return entry.isAccessorOrMethod || new PropertyDescriptor(entry.value, this.#options).canReplaceValue
  }

  #writtenValueOf(entry) {
    return entry.isAccessorOrMethod ? null : new PropertyDescriptor(entry.value, this.#options).writtenValue
  }
}

class PropertyDescriptor {
  #bindings
  #hasDefaultPrototype
  #isKeyValid
  #node
  #source

  constructor(node, { bindings, hasDefaultPrototype, isKeyValid }) {
    this.#source = new PropertySourceValue(node, bindings, { requiresUnexposedObject: true })
    this.#node = this.#source.node
    this.#bindings = bindings
    this.#hasDefaultPrototype = hasDefaultPrototype
    this.#isKeyValid = isKeyValid
  }

  get canReplaceValue() {
    if (this.#source.isRegExpLiteral) return this.#canReplaceThroughRegExpPrototype
    if (this.#node.type !== "ObjectExpression") return !this.#source.isPrimitive
    return this.#node.properties.some((property) => this.#canReplaceValueThrough(property))
      || this.#canReplaceThroughPrototype
  }

  get writtenValue() {
    return this.#node?.type === "ObjectExpression"
      ? this.#node.properties.reduce((value, property) => this.#valueAfter(value, property), null)
      : null
  }

  get #canReplaceThroughRegExpPrototype() {
    return !this.#hasDefaultPrototype(this.#node, "RegExp")
      || !this.#hasDefaultPrototype(this.#node, "Object")
  }

  #canReplaceValueThrough(property) {
    if (property.type === "SpreadElement") return this.#descriptorFor(property.argument).canReplaceValue

    const entry = new ResolvedObjectProperty(property, { bindings: this.#bindings, isKeyValid: this.#isKeyValid })
    return !entry.isPrototypeSetter && entry.canReplaceDescriptorValue
  }

  #descriptorFor(node) {
    return new PropertyDescriptor(node, {
      bindings: this.#bindings,
      hasDefaultPrototype: this.#hasDefaultPrototype,
      isKeyValid: this.#isKeyValid
    })
  }

  get #canReplaceThroughPrototype() {
    const prototype = this.#node.properties
      .filter((property) => property.type === "Property")
      .map((property) => new ResolvedObjectProperty(property, {
        bindings: this.#bindings, isKeyValid: this.#isKeyValid
      }))
      .find((property) => property.isPrototypeSetter)
    return prototype
      ? !new PropertySourceValue(prototype.value, this.#bindings).isNullLiteral
      : !this.#hasDefaultPrototype(this.#node)
  }

  #valueAfter(value, property) {
    return property.type === "SpreadElement"
      ? this.#descriptorFor(property.argument).#valueStartingAt(value)
      : valueAfterEntry(value, this.#entryFor(property))
  }

  #entryFor(property) {
    return new ResolvedObjectProperty(property, { bindings: this.#bindings, isKeyValid: this.#isKeyValid })
  }

  #valueStartingAt(value) {
    return this.#node?.type === "ObjectExpression"
      ? this.#node.properties.reduce((current, property) => this.#valueAfter(current, property), value)
      : this.#valueStartingOutsideObject(value)
  }

  #valueStartingOutsideObject(value) {
    return this.#source.isPrimitive || this.#source.isRegExpLiteral ? value : null
  }
}

function valueAfterEntry(value, entry) {
  return entry.writeName === "value" ? entry.writtenValue : valueForNonDescriptorValue(value, entry.writeName)
}

function valueForNonDescriptorValue(value, name) {
  return name === null ? null : value
}
