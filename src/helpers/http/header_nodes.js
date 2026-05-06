import { ObjectPropertyValues } from "#helpers/objects/object_property_values"
import { ObjectReferenceUse } from "#helpers/objects/object_reference_use"
import { ObjectValueConfinement } from "#helpers/objects/object_value_confinement"
import { resolvedPublicMemberNameOf } from "#helpers/classes/resolved_member_key"

export class HeaderNodes {
  #argumentConfinement
  #argumentValues
  #confinement
  #properties
  #resolvedNodes = new WeakMap()
  #resolving = new WeakSet()
  #writes

  constructor(values, writes) {
    this.bindings = values.bindings
    this.#argumentConfinement = values.argumentConfinement
    this.#argumentValues = values.argumentValues
    this.#writes = writes
    this.#confinement = new ObjectValueConfinement(values.bindings, {
      isTrackedReference: (identifier) => new ObjectReferenceUse(identifier, values.bindings).hasTrackedWrite
        || values.argumentConfinement.includes(identifier)
    })
    this.#properties = new ObjectPropertyValues(values.bindings, writes)
  }

  propertyValueIn(object, name, at) {
    return this.#properties.valueIn(object, name, at)
  }

  hasWritesBefore(object, at) {
    return this.#writes.hasAnyBefore(object, at)
  }

  stableObjectsOf(node) {
    return this.resolvedValuesOf(node).filter((value) => value?.type === "ObjectExpression")
  }

  resolvedValuesOf(node, at = node) {
    return this.#inputValuesOf(node).map((value) =>
      this.#resolvedNodeOf(new HeaderNodePosition(value, value === node ? at : value)))
  }

  soleResolvedValueOf(node) {
    if (node) {
      const values = this.resolvedValuesOf(node).filter(Boolean)
      return values.length === 1 ? values[0] : null
    } else {
      return null
    }
  }

  #inputValuesOf(node) {
    if (node?.type !== "Identifier") return this.#argumentValues.valuesOf(node)
    if (this.#argumentConfinement.canResolve(node)) return this.#argumentValues.valuesOf(node)
    return this.bindings.stableValueFor(node) ? [ node ] : this.#argumentValues.valuesOf(node)
  }

  #resolvedNodeOf(position) {
    const { at, node } = position
    if (!node || this.#resolving.has(node)) return null

    const resolvedNodes = this.#resolvedNodesAt(at)
    if (resolvedNodes.has(node)) return resolvedNodes.get(node)

    this.#resolving.add(node)
    try {
      const resolved = this.#uncachedResolvedNodeOf(position)
      resolvedNodes.set(node, resolved)
      return resolved
    } finally {
      this.#resolving.delete(node)
    }
  }

  #resolvedNodesAt(at) {
    if (!this.#resolvedNodes.has(at)) this.#resolvedNodes.set(at, new WeakMap())
    return this.#resolvedNodes.get(at)
  }

  #uncachedResolvedNodeOf(position) {
    const { node } = position
    switch (node.type) {
      case "Identifier": return this.#resolvedIdentifierOf(position)
      case "MemberExpression": return this.#memberValueOf(position)
      default: return node
    }
  }

  #resolvedIdentifierOf(position) {
    const { node: identifier } = position
    const value = this.bindings.stableValueFor(identifier)
    return this.#canFollowObjectAt(position, value)
      ? this.#resolvedNodeOf(position.withNode(value))
      : null
  }

  #canFollowObjectAt(position, value) {
    return value?.type !== "ObjectExpression" || position.node.type !== "Identifier"
      || this.bindings.stableValueFor(position.node) !== value
      || this.#confinement.isSafeAt(position.node, position.at)
  }

  #memberValueOf(position) {
    const { at, node: member } = position
    const object = this.#resolvedNodeOf(position.withNode(member.object))
    const name = resolvedPublicMemberNameOf(member, this.bindings)
    return name !== null && object?.type === "ObjectExpression"
      ? this.#resolvedNodeOf(position.withNode(this.propertyValueIn(object, name, at)))
      : null
  }
}

class HeaderNodePosition {
  constructor(node, at) {
    this.node = node
    this.at = at
  }

  withNode(node) {
    return new HeaderNodePosition(node, this.at)
  }
}
