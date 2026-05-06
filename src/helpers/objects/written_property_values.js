import { ExecutionDominance } from "#helpers/flow/execution_dominance"

const NO_PROPERTY_WRITE = Symbol("no property write")

export class WrittenPropertyValues {
  #dominance
  #writesByObject = new WeakMap()

  constructor(root) {
    this.#dominance = new ExecutionDominance(root)
  }

  add(object, write) {
    if (!this.#writesByObject.has(object)) {
      this.#writesByObject.set(object, new ObjectWrites(this.#dominance))
    }
    this.#writesByObject.get(object).add(write)
  }

  valueBefore(object, name, node) {
    const writes = this.#writesByObject.get(object)
    return writes ? writes.valueBefore(name, node) : NO_PROPERTY_WRITE
  }

  isNoWrite(value) {
    return value === NO_PROPERTY_WRITE
  }

  hasAnyBefore(object, node) {
    return this.#writesByObject.get(object)?.hasAnyBefore(node) === true
  }
}

class ObjectWrites {
  #allPositions
  #dominance
  #nextOrder = 0
  #writeIndexes = new Map()
  #writesByName = new Map()

  constructor(dominance) {
    this.#allPositions = dominance.positions
    this.#dominance = dominance
  }

  add(write) {
    if (!this.#writesByName.has(write.name)) this.#writesByName.set(write.name, [])
    const propertyWrite = new PropertyWrite(write, this.#nextOrder)
    propertyWrite.addTo(this.#allPositions)
    this.#writesByName.get(write.name).push(propertyWrite)
    this.#writeIndexes.delete(write.name)
    this.#nextOrder += 1
  }

  hasAnyBefore(node) {
    return this.#allPositions.hasBefore(node)
  }

  valueBefore(name, node) {
    return writtenValueOf(latestOf(this.#writeIndexFor(null).latestBefore(node), this.#namedWriteBefore(name, node)))
  }

  #writeIndexFor(name) {
    if (!this.#writeIndexes.has(name)) {
      this.#writeIndexes.set(name, new PropertyWriteIndex(this.#writesFor(name), this.#dominance))
    }
    return this.#writeIndexes.get(name)
  }

  #writesFor(name) {
    return this.#writesByName.get(name) ?? []
  }

  #namedWriteBefore(name, node) {
    return name === null ? null : this.#writeIndexFor(name).latestBefore(node)
  }
}

class PropertyWrite {
  #operation
  #order

  constructor({ operation, value }, order) {
    this.#operation = operation
    this.#order = order
    this.value = value
  }

  addTo(positions) {
    positions.add(this.#operation)
  }

  isAfter(other) {
    return this.#operation.range[1] > other.#operation.range[1]
      || (this.#operation.range[1] === other.#operation.range[1] && this.#order > other.#order)
  }
}

function writtenValueOf(write) {
  return write ? write.value : NO_PROPERTY_WRITE
}

function latestOf(first, second) {
  return !first || second?.isAfter(first) ? second : first
}

class PropertyWriteIndex {
  #root

  constructor(writes, dominance) {
    const ordered = writes.toSorted((left, right) => left.isAfter(right) ? 1 : -1)
    this.#root = ordered.length === 0
      ? null
      : new PropertyWriteRange({ dominance, writes: ordered, start: 0, end: ordered.length })
  }

  latestBefore(node) {
    return this.#root?.latestBefore(node) ?? null
  }
}

class PropertyWriteRange {
  #left = null
  #positions
  #right = null
  #write = null

  constructor({ dominance, end, start, writes }) {
    this.#positions = dominance.positions
    for (let index = start; index < end; index += 1) writes[index].addTo(this.#positions)
    if (end - start === 1) this.#write = writes[start]
    else {
      const middle = Math.floor((start + end) / 2)
      this.#left = new PropertyWriteRange({ end: middle, dominance, start, writes })
      this.#right = new PropertyWriteRange({ start: middle, dominance, end, writes })
    }
  }

  latestBefore(node) {
    return this.#positions.hasBefore(node) ? this.#latestBefore(node) : null
  }

  #latestBefore(node) {
    return this.#write ?? this.#right.latestBefore(node) ?? this.#left.latestBefore(node)
  }
}
