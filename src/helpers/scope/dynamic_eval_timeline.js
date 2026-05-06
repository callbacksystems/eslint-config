import { ExecutionPosition } from "#helpers/flow/execution_position"

export class DynamicEvalTimeline {
  #evalCount = 0
  #summariesBySequence = new WeakMap()

  add(node, scope) {
    this.#evalCount += 1
    const position = ExecutionPosition.of(node, scope)
    if (position) {
      if (!this.#summariesBySequence.has(position.sequence)) {
        this.#summariesBySequence.set(position.sequence, new EvalPositionSummary())
      }
      this.#summariesBySequence.get(position.sequence).add(position.position)
    }
  }

  isLookupBeforeAllEvals(lookup) {
    const position = ExecutionPosition.of(lookup.identifier, lookup.scope)
    if (!position || !lookup.hasLifetimeIn(position.executionScope)) return false

    const summary = this.#summariesBySequence.get(position.sequence)
    return summary?.count === this.#evalCount && position.position < summary.firstPosition
  }
}

class EvalPositionSummary {
  count = 0
  firstPosition = Infinity

  add(position) {
    this.count += 1
    this.firstPosition = Math.min(this.firstPosition, position)
  }
}
