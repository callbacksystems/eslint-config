import { ExecutionDominance } from "#helpers/flow/execution_dominance"
import { repeatedAncestorsOf } from "#helpers/flow/repeated_ancestors"

export class PointwiseAliasConfinement {
  #unsafeReferences

  constructor(references, { isSafeReference, rootScope, sourceCode }) {
    this.#unsafeReferences = new UnsafeReferencePositions(
      references.filter(new ReachableUnsafeReferences(sourceCode, isSafeReference).includes), rootScope)
  }

  isSafeAt(target, reference, { ignoredReference = null } = {}) {
    return !this.#unsafeReferences.hasBefore({
      executionScope: reference?.from.variableScope,
      node: target,
      ignoredReference
    })
  }
}

class UnsafeReferencePositions {
  #count
  #firstReference = null
  #secondReference = null
  #outsideCount = 0
  #outsideReferences = new WeakSet()
  #repeatingReferences = new RepeatingUnsafeReferences()
  #rootScope
  #values = new WeakSet()

  constructor(references, rootScope) {
    this.#count = references.length
    this.#rootScope = rootScope
    references.forEach((reference) => this.#add(reference))
  }

  hasBefore({ executionScope, ignoredReference, node }) {
    if (this.#effectiveCount(ignoredReference) === 0) return false
    if (executionScope !== this.#rootScope || this.#hasOutside(ignoredReference)) return true
    if (this.#isFirstBefore(node, ignoredReference)) return true

    return this.#repeatingReferences.includes(node, { ignoredReference })
  }

  #add(reference) {
    this.#values.add(reference)
    if (reference.from.variableScope === this.#rootScope) {
      this.#rememberFirst(reference)
      this.#repeatingReferences.add(reference)
    } else {
      this.#outsideCount += 1
      this.#outsideReferences.add(reference)
    }
  }

  #rememberFirst(reference) {
    if (!this.#firstReference || reference.identifier.range[0] < this.#firstReference.identifier.range[0]) {
      this.#prependReference(reference)
    } else if (!this.#secondReference
      || reference.identifier.range[0] < this.#secondReference.identifier.range[0]) this.#replaceSecond(reference)
  }

  #prependReference(reference) {
    this.#secondReference = this.#firstReference
    this.#firstReference = reference
  }

  #replaceSecond(reference) {
    this.#secondReference = reference
  }

  #effectiveCount(ignoredReference) {
    return this.#count - (ignoredReference && this.#values.has(ignoredReference) ? 1 : 0)
  }

  #hasOutside(ignoredReference) {
    return this.#outsideCount > (ignoredReference && this.#outsideReferences.has(ignoredReference) ? 1 : 0)
  }

  #isFirstBefore(node, ignoredReference) {
    const first = this.#firstReference === ignoredReference ? this.#secondReference : this.#firstReference
    return Boolean(first) && first.identifier.range[0] < node.range[1]
  }
}

class RepeatingUnsafeReferences {
  #ancestorCounts = new WeakMap()
  #ancestorsByReference = new WeakMap()
  #repeatingAncestorsByNode = new WeakMap()

  add(reference) {
    const ancestors = new Set(repeatedAncestorsOf(reference.identifier))
    ancestors.forEach((ancestor) =>
      this.#ancestorCounts.set(ancestor, (this.#ancestorCounts.get(ancestor) ?? 0) + 1))
    this.#ancestorsByReference.set(reference, ancestors)
  }

  includes(node, { ignoredReference }) {
    const ignoredAncestors = this.#ancestorsByReference.get(ignoredReference)
    return this.#repeatingAncestorsOf(node).some((ancestor) =>
      (this.#ancestorCounts.get(ancestor) ?? 0) > (ignoredAncestors?.has(ancestor) ? 1 : 0))
  }

  #repeatingAncestorsOf(node) {
    if (!this.#repeatingAncestorsByNode.has(node)) {
      this.#repeatingAncestorsByNode.set(node, repeatedAncestorsOf(node))
    }
    return this.#repeatingAncestorsByNode.get(node)
  }
}

class ReachableUnsafeReferences {
  #execution
  #isSafeReference

  constructor(sourceCode, isSafeReference) {
    this.#execution = new ExecutionDominance(sourceCode.ast)
    this.#isSafeReference = isSafeReference
  }

  includes = (reference) =>
    this.#execution.isReachable(reference.identifier) && !this.#isSafeReference(reference)
}
