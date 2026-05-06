const INDEXES_BY_CALL = new WeakMap()

export class CallArguments {
  #call

  constructor(call) {
    this.#call = call
  }

  stablePositionOf(argument) {
    const position = this.positionOf(argument)
    return position < this.#index.firstSpread ? position : -1
  }

  positionOf(argument) {
    return this.#index.positions.get(argument) ?? -1
  }

  get #index() {
    if (!INDEXES_BY_CALL.has(this.#call)) INDEXES_BY_CALL.set(this.#call, new ArgumentIndex(this.#call.arguments))
    return INDEXES_BY_CALL.get(this.#call)
  }
}

class ArgumentIndex {
  firstSpread = Infinity
  positions = new Map()

  constructor(argumentsList) {
    argumentsList.forEach((argument, position) => this.#add(argument, position))
  }

  #add(argument, position) {
    this.positions.set(argument, position)
    if (argument.type === "SpreadElement" && this.firstSpread === Infinity) this.firstSpread = position
  }
}
