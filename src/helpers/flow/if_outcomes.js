import { PossibleOutcomes } from "#helpers/flow/possible_outcomes"
import { StaticCondition } from "#helpers/syntax/static_condition"

const NORMAL = 1

export class IfOutcomes {
  #statement
  #outcomes
  #condition

  constructor(statement, outcomes) {
    this.#statement = statement
    this.#outcomes = outcomes
    this.#condition = new StaticCondition(statement.test).value
  }

  get value() {
    if (this.#condition === true) return this.#consequent
    if (this.#condition === false) return this.#alternate
    return this.#consequent.union(this.#alternate)
  }

  get #consequent() {
    return this.#outcomes.outcomesFor(this.#statement.consequent)
  }

  get #alternate() {
    return this.#statement.alternate
      ? this.#outcomes.outcomesFor(this.#statement.alternate)
      : new PossibleOutcomes(NORMAL)
  }
}
