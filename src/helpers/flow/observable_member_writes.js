import { ObservableValue } from "#helpers/flow/observable_value"

const EFFECT = "effect"
const UNKNOWN = "unknown"

export class ObservableMemberWrites {
  #bindings
  #cachedStatuses
  #functionNode
  #targets

  constructor(targets, { functionNode, bindings }) {
    this.#targets = targets
    this.#functionNode = functionNode
    this.#bindings = bindings
  }

  get isUnknown() {
    return !this.exists && this.#statuses.includes(UNKNOWN)
  }

  get exists() {
    return this.#statuses.includes(EFFECT)
  }

  get #statuses() {
    return this.#cachedStatuses ??= this.#targets.map((target) =>
      new ObservableValue(target, this.#functionNode, this.#bindings).status)
  }
}
