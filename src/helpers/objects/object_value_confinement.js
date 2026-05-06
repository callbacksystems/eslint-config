import { StableAliasGroups } from "#helpers/scope/stable_alias_groups"
import { ObjectSpreadEvaluation } from "#helpers/objects/object_spread_evaluation"

const READ_ONLY_BY_SOURCE = new WeakMap()

export class ObjectValueConfinement {
  #aliases
  #isTrackedReference

  static readOnlyFor(bindings) {
    const { sourceCode } = bindings
    if (!READ_ONLY_BY_SOURCE.has(sourceCode)) {
      READ_ONLY_BY_SOURCE.set(sourceCode, new ObjectValueConfinement(bindings))
    }
    return READ_ONLY_BY_SOURCE.get(sourceCode)
  }

  constructor(bindings, { isTrackedReference = () => false } = {}) {
    this.#aliases = StableAliasGroups.for(bindings.sourceCode, bindings)
    this.#isTrackedReference = isTrackedReference
  }

  isSafeAt(identifier, target = identifier) {
    const group = this.#aliases.groupFor(identifier)
    const reference = this.#aliases.referenceFor(identifier)
    return group && reference
      ? group.isConfinedAt({
        ignoredReference: reference,
        isSafeReference: (candidate) => this.#isSafeReference(candidate, group.root),
        policy: this,
        reference,
        target
      })
      : false
  }

  #isSafeReference(reference, source) {
    return isSafeSpreadRead(reference.identifier, source) || this.#isTrackedReference(reference.identifier)
  }
}

function isSafeSpreadRead(identifier, source) {
  return identifier.parent?.type === "SpreadElement" && identifier.parent.argument === identifier
    && new ObjectSpreadEvaluation(source).isSideEffectFree
}
