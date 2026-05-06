import { classElementHolding, isLexicalThisOf } from "#helpers/syntax/classes"
import { resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { staticStringValueOf } from "#helpers/syntax/literals"
import { NearestAncestor } from "#helpers/syntax/nearest_ancestor"

const CONFIG_KEYS = new Set([ "targets", "classes", "values", "outlets" ])
const IDENTIFIER_PART = "[a-z0-9]+(?:-[a-z0-9]+)*"
const STIMULUS_CONTROLLER_IDENTIFIER = new RegExp(`^${IDENTIFIER_PART}(?:--${IDENTIFIER_PART})*$`, "u")
const enclosingControllers = new NearestAncestor(isStimulusController)

export function isStimulusController(classNode) {
  return classNode.superClass?.type === "Identifier" && classNode.superClass.name === "Controller"
}

export function enclosingStimulusController(node) {
  return enclosingControllers.above(node)
}

export function isControllerInstanceThis(node, controller = enclosingStimulusController(node)) {
  return node?.type === "ThisExpression" && isControllerInstanceContext(node, controller)
}

export function isControllerInstanceContext(node, controller = enclosingStimulusController(node)) {
  return Boolean(node) && Boolean(controller) && new ControllerContext(node, controller).isInstance
}

export function isStimulusControllerIdentifier(name) {
  return typeof name === "string" && STIMULUS_CONTROLLER_IDENTIFIER.test(name)
}

export function stimulusPropertyStemOf(identifier) {
  return identifier.replaceAll("--", "-").replaceAll(/-([a-z0-9])/gu, (_, character) => character.toUpperCase())
}

export function stimulusControllerConfigOf(classBody, bindings) {
  return new StimulusControllerConfig(classBody, bindings)
}

class ControllerContext {
  #node
  #controller

  constructor(node, controller) {
    this.#node = node
    this.#controller = controller
  }

  get isInstance() {
    return this.#isInsideInstanceMember(classElementHolding(this.#node, this.#controller))
  }

  #isInsideInstanceMember(member) {
    return Boolean(member) && !member.static && Boolean(member.value)
      && (this.#node === member.value || isLexicalThisOf(this.#node, member.value))
  }
}

class StimulusControllerConfig {
  #classBody
  #bindings
  #cachedEntries

  constructor(classBody, bindings) {
    this.#classBody = classBody
    this.#bindings = bindings
  }

  get entries() {
    return this.#cachedEntries ??= this.#classBody.body
      .map((member) => new StimulusConfigEntry(member, this.#bindings))
      .filter((entry) => entry.isConfig)
  }

  namesIn(name) {
    return this.#entryFor(name)?.names ?? []
  }

  arrayNamesIn(name) {
    return this.#entryFor(name)?.arrayNames ?? []
  }

  objectNamesIn(name) {
    return this.#entryFor(name)?.objectNames ?? []
  }

  #entryFor(name) {
    return this.entries.findLast((entry) => entry.name === name)
  }
}

class StimulusConfigEntry {
  #member
  #bindings
  #cachedKey
  #cachedValue

  constructor(member, bindings) {
    this.#member = member
    this.#bindings = bindings
  }

  get isConfig() {
    return this.#member.type === "PropertyDefinition" && this.#member.static
      && CONFIG_KEYS.has(this.name)
  }

  get name() {
    return this.#key?.name ?? null
  }

  get declarations() {
    return this.#value.declarations
  }

  get names() {
    return this.#value.names
  }

  get arrayNames() {
    return this.#value.arrayNames
  }

  get objectNames() {
    return this.#value.objectNames
  }

  get #key() {
    return this.#cachedKey ??= resolvedMemberKeyOf(this.#member, this.#bindings)
  }

  get #value() {
    return this.#cachedValue ??= new StimulusConfigValue(this.#member.value, this.#bindings)
  }
}

class StimulusConfigValue {
  #node
  #bindings
  #cachedArrayDeclarations
  #cachedObjectDeclarations
  #cachedObjectNames

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
  }

  get declarations() {
    if (this.#node?.type === "ArrayExpression") return this.#arrayDeclarations
    return this.#node?.type === "ObjectExpression" ? this.#objectDeclarations : []
  }

  get names() {
    return this.#node?.type === "ArrayExpression" ? this.arrayNames : this.objectNames
  }

  get arrayNames() {
    return this.#arrayDeclarations.map((declaration) => declaration.name)
  }

  get objectNames() {
    return this.#cachedObjectNames ??= this.#node?.type === "ObjectExpression"
      ? this.#node.properties
        .filter((property) => property.type === "Property")
        .map((property) => resolvedMemberKeyOf(property, this.#bindings)?.name ?? null)
        .filter(Boolean)
      : []
  }

  get #arrayDeclarations() {
    return this.#cachedArrayDeclarations ??= this.#node?.type === "ArrayExpression"
      ? this.#node.elements
        .map((element) => new StimulusDeclaredName(element, staticStringValueOf(element)))
        .filter((declaration) => declaration.name !== null)
      : []
  }

  get #objectDeclarations() {
    return this.#cachedObjectDeclarations ??= this.#node?.type === "ObjectExpression"
      ? this.#node.properties
        .filter((property) => property.type === "Property")
        .map((property) => new StimulusDeclaredName(property.key, declaredStringNameOf(property, this.#bindings)))
        .filter((declaration) => declaration.name !== null)
      : []
  }
}

class StimulusDeclaredName {
  constructor(node, name) {
    this.node = node
    this.name = name
  }
}

function declaredStringNameOf(property, bindings) {
  if (property.key.type === "Identifier") {
    return property.computed ? resolvedMemberKeyOf(property, bindings)?.name ?? null : property.key.name
  }
  return staticStringValueOf(property.key)
}
