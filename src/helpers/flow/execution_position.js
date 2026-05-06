const SEQUENCE_TYPES = new Set([ "BlockStatement", "Program", "StaticBlock", "SwitchCase" ])

export class ExecutionPosition {
  static of(node, scope) {
    return new ExecutionPositionWalk(node, scope?.variableScope).value
  }

  constructor(executionScope, sequence, position) {
    this.executionScope = executionScope
    this.sequence = sequence
    this.position = position
  }
}

class ExecutionPositionWalk {
  #current
  #executionScope
  #position = null

  constructor(node, executionScope) {
    this.#current = node
    this.#executionScope = executionScope
  }

  get value() {
    while (this.#canAdvance) this.#advance()
    return this.#current === this.#executionScope?.block
      ? this.#position ?? new ExecutionPosition(this.#executionScope, this.#current, this.#current.range[0])
      : null
  }

  get #canAdvance() {
    return Boolean(this.#current) && this.#current !== this.#executionScope?.block
  }

  #advance() {
    const { parent } = this.#current
    if (SEQUENCE_TYPES.has(parent?.type)) {
      this.#position = new ExecutionPosition(this.#executionScope, parent, this.#current.range[0])
    }
    this.#current = parent
  }
}
