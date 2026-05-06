const INDEXES = new WeakMap()

export function referencesIn(scopeManager) {
  if (!INDEXES.has(scopeManager)) {
    INDEXES.set(scopeManager, new Map(scopeManager.scopes.flatMap((scope) => scope.references)
      .map((reference) => [ reference.identifier, reference ])))
  }
  return INDEXES.get(scopeManager)
}

export function isReassignment(reference) {
  return reference.isWrite() && !reference.init
}

export function isOnlyReferenceBefore(binding, { identifier, before }) {
  return binding.references.every((reference) =>
    reference.init || reference.identifier === identifier || reference.identifier.range[0] > before.range[1])
}
