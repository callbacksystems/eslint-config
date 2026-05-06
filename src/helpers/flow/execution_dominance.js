import { FunctionExecutionContexts } from "#helpers/flow/function_execution_contexts"
import { isFunction } from "#helpers/syntax/functions"
import { StaticCondition } from "#helpers/syntax/static_condition"

const SEQUENCE_TYPES = new Set([
  "BlockStatement", "ForStatement", "Program", "SequenceExpression", "StaticBlock", "SwitchCase"
])
const INDEXES = new WeakMap()

export class ExecutionDominance {
  #index

  constructor(root) {
    this.#index = indexFor(root)
  }

  get positions() {
    return new DominatingPositions(this.#index)
  }

  hasPositionAfter(operation) {
    return this.#index.pointsAfter(operation).length > 0
  }

  isReachable(node) {
    return this.#index.isReachable(node)
  }
}

function indexFor(root) {
  if (!INDEXES.has(root)) INDEXES.set(root, new ExecutionIndex(root))
  return INDEXES.get(root)
}

class ExecutionIndex {
  #nodes = new WeakSet()
  #pointsAfter = new WeakMap()
  #pointsAt = new WeakMap()

  constructor(root) {
    new FunctionExecutionContexts(root).forEach((context) => this.#nodes.add(context.node))
  }

  isReachable(node) {
    return this.#nodes.has(node)
  }

  pointsAfter(operation) {
    if (!this.#pointsAfter.has(operation)) {
      this.#pointsAfter.set(operation, new EnclosingSequencePoints(operation, {
        execution: this.#nodes, onlyDominating: true
      }).values)
    }
    return this.#pointsAfter.get(operation)
  }

  pointsAt(node) {
    if (!this.#pointsAt.has(node)) this.#pointsAt.set(node, new EnclosingSequencePoints(node).values)
    return this.#pointsAt.get(node)
  }
}

class EnclosingSequencePoints {
  #execution
  #node
  #onlyDominating

  constructor(node, { execution = null, onlyDominating = false } = {}) {
    this.#node = node
    this.#execution = execution
    this.#onlyDominating = onlyDominating
  }

  get values() {
    return this.#isReachablePosition
      ? this.#ancestors()
        .filter((node) => new ParentRelation(node).hasSequenceParent)
        .map((node) => new SequencePoint(node.parent, node.range[0]))
        .toArray()
      : []
  }

  get #isReachablePosition() {
    return !this.#onlyDominating || this.#execution.has(this.#node)
  }

  *#ancestors() {
    let current = this.#positionNode
    while (this.#canInclude(current)) {
      yield current
      current = current.parent
    }
  }

  get #positionNode() {
    return this.#node
  }

  #canInclude(node) {
    const relation = new ParentRelation(node)
    return relation.hasParent && !relation.hasFunctionParent
      && (!this.#onlyDominating || relation.hasDominatingSequenceParent || relation.isGuaranteedWrapper)
  }
}

class ParentRelation {
  #node

  constructor(node) {
    this.#node = node
  }

  get hasParent() {
    return Boolean(this.#node.parent)
  }

  get hasFunctionParent() {
    return isFunction(this.#node.parent)
  }

  get hasDominatingSequenceParent() {
    return this.hasSequenceParent
      && (this.#node.parent.type !== "ForStatement" || this.#node.parent.init === this.#node)
  }

  get hasSequenceParent() {
    return SEQUENCE_TYPES.has(this.#node.parent.type)
  }

  get isGuaranteedWrapper() {
    if (this.#node.parent.type === "ExpressionStatement") return this.#node.parent.expression === this.#node
    if (this.#node.parent.type !== "IfStatement") return false

    const condition = new StaticCondition(this.#node.parent.test).value
    return (condition === true && this.#node.parent.consequent === this.#node)
      || (condition === false && this.#node.parent.alternate === this.#node)
  }
}

class SequencePoint {
  constructor(sequence, position) {
    this.sequence = sequence
    this.position = position
  }
}

class DominatingPositions {
  #firstPositions = new WeakMap()
  #index

  constructor(index) {
    this.#index = index
  }

  add(operation) {
    this.#index.pointsAfter(operation).forEach((point) => {
      const first = this.#firstPositions.get(point.sequence) ?? Infinity
      this.#firstPositions.set(point.sequence, Math.min(first, point.position))
    })
  }

  hasBefore(node) {
    return this.#index.pointsAt(node).some((point) =>
      (this.#firstPositions.get(point.sequence) ?? Infinity) < point.position)
  }
}
