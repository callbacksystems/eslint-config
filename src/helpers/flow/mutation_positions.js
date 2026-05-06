import { ExecutionPosition } from "#helpers/flow/execution_position"

export class MutationPositions {
  #count = 0
  #positionsBySequence = new WeakMap()
  #rootScope

  constructor(rootScope) {
    this.#rootScope = rootScope
  }

  add(operation, scope) {
    this.#count += 1
    const position = ExecutionPosition.of(operation, scope)
    if (position?.executionScope === this.#rootScope) this.#summaryFor(position.sequence).add(position.position)
  }

  hasBefore(target, scope) {
    if (this.#count === 0) return false

    const position = ExecutionPosition.of(target, scope)
    if (position?.executionScope !== this.#rootScope) return true

    const summary = this.#positionsBySequence.get(position.sequence)
    return summary?.count !== this.#count || summary.firstPosition <= position.position
  }

  #summaryFor(sequence) {
    if (!this.#positionsBySequence.has(sequence)) {
      this.#positionsBySequence.set(sequence, new MutationPositionSummary())
    }
    return this.#positionsBySequence.get(sequence)
  }
}

class MutationPositionSummary {
  count = 0
  firstPosition = Infinity

  add(position) {
    this.count += 1
    this.firstPosition = Math.min(this.firstPosition, position)
  }
}
