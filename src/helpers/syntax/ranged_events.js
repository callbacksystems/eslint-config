// Position-sorted events support cheap containment and range-maximum queries after a single collection pass.

import bounds from "binary-search-bounds"

export class RangedEvents {
  #maximums = null
  #positions = []
  #values = []

  add(position, value = 0) {
    this.#positions.push(position)
    this.#values.push(value)
    this.#maximums = null
  }

  hasInside(range) {
    const [ start, end ] = range
    const index = bounds.ge(this.#positions, start)
    return index < this.#positions.length && this.#positions.at(index) < end
  }

  maximumInside(range) {
    return this.#maximumIndex.maximumBetween(bounds.ge(this.#positions, range[0]), bounds.ge(this.#positions, range[1]))
  }

  get #maximumIndex() {
    return this.#maximums ??= new RangeMaximum(this.#values)
  }
}

class RangeMaximum {
  #size = 1
  #values

  constructor(values) {
    while (this.#size < values.length) this.#size *= 2
    this.#values = Array.from({ length: this.#size * 2 }, () => -1)
    values.forEach((value, index) => {
      this.#values[this.#size + index] = value
    })
    for (let index = this.#size - 1; index > 0; index -= 1) {
      this.#values[index] = Math.max(this.#values[index * 2], this.#values[index * 2 + 1])
    }
  }

  maximumBetween(start, end) {
    return new MaximumQuery({ values: this.#values, size: this.#size, start, end }).value
  }
}

class MaximumQuery {
  #left
  #maximum = -1
  #right
  #values

  constructor({ values, size, start, end }) {
    this.#values = values
    this.#left = start + size
    this.#right = end + size
  }

  get value() {
    while (this.#left < this.#right) this.#advance()
    return this.#maximum
  }

  #advance() {
    if (this.#left % 2 === 1) this.#takeLeft()
    if (this.#right % 2 === 1) this.#takeRight()
    this.#left = Math.floor(this.#left / 2)
    this.#right = Math.floor(this.#right / 2)
  }

  #takeLeft() {
    this.#maximum = Math.max(this.#maximum, this.#values[this.#left])
    this.#left += 1
  }

  #takeRight() {
    this.#right -= 1
    this.#maximum = Math.max(this.#maximum, this.#values[this.#right])
  }
}
