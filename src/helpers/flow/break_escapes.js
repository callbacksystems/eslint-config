import { NearestAncestor } from "#helpers/syntax/nearest_ancestor"
import { RangedEvents } from "#helpers/syntax/ranged_events"

const BREAKABLE_TYPES = new Set([
  "DoWhileStatement", "ForInStatement", "ForOfStatement", "ForStatement", "SwitchStatement", "WhileStatement"
])
const nearestBreakable = new NearestAncestor((node) => BREAKABLE_TYPES.has(node.type))

export class BreakEscapes {
  #sourceEnd
  #events = new RangedEvents()

  constructor(sourceEnd) {
    this.#sourceEnd = sourceEnd
  }

  add(node) {
    const target = new BreakTarget(node).value
    if (target) this.#events.add(node.range[0], this.#sourceEnd - target.range[0])
  }

  hasCrossingFor(statement) {
    return this.#events.maximumInside(statement.body.range) >= this.#sourceEnd - statement.range[0]
  }
}

class BreakTarget {
  #node

  constructor(node) {
    this.#node = node
  }

  get value() {
    return this.#node.label ? this.#labeled : nearestBreakable.above(this.#node)
  }

  get #labeled() {
    for (let current = this.#node.parent; current; current = current.parent) {
      if (current.type === "LabeledStatement" && current.label.name === this.#node.label.name) return current
    }
    return null
  }
}
