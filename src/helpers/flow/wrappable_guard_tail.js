import { childNodesOf } from "#helpers/syntax/ast"
import { guardReturnOf, isAnyExit, isFunction, isFunctionExit, isIfWithoutAlternate } from "#helpers/syntax/functions"

const MAX_TOTAL_DEPTH = 3
const NESTING_TYPES = new Set([
  "IfStatement", "ForStatement", "ForInStatement", "ForOfStatement",
  "WhileStatement", "DoWhileStatement", "SwitchStatement", "TryStatement"
])

export class WrappableGuardTail {
  #statements
  #facts
  #index
  #first = -1

  constructor(statements) {
    this.#statements = statements
  }

  get firstIndex() {
    if (this.#statements.length < 2) return -1

    this.#facts = new TailFacts(this.#statements.at(-1))
    for (this.#index = this.#statements.length - 2; this.#index >= 0; this.#index -= 1) this.#inspect()
    return this.#first
  }

  #inspect() {
    if (this.#isCandidate) this.#first = this.#index
    this.#facts.prepend(this.#statement)
  }

  get #isCandidate() {
    return isNegativeReturnGuard(this.#statement) && this.#facts.accepts(guardReturnOf(this.#statement))
  }

  get #statement() {
    return this.#statements[this.#index]
  }
}

class TailFacts {
  #last
  #maxDepth
  #allWrappable
  #beforeLastWrappable = true

  constructor(last) {
    this.#last = last
    this.#maxDepth = new NestingDepth(last).value
    this.#allWrappable = !new ExitSearch(last).hasExit
  }

  accepts(guardReturn) {
    return this.#maxDepth + 1 <= MAX_TOTAL_DEPTH
      && (guardReturn.argument
        ? isFunctionExit(this.#last) && this.#beforeLastWrappable
        : this.#allWrappable)
  }

  prepend(statement) {
    const isWrappable = !new ExitSearch(statement).hasExit
    this.#maxDepth = Math.max(this.#maxDepth, new NestingDepth(statement).value)
    this.#allWrappable &&= isWrappable
    this.#beforeLastWrappable &&= isWrappable
  }
}

// Nested function bodies reset depth, matching `max-depth`.
class NestingDepth {
  #pending
  #maximum = 0

  constructor(root) {
    this.#pending = [ new DepthEntry({ node: root, parentDepth: 0 }) ]
  }

  get value() {
    while (this.#pending.length > 0) this.#visit(this.#pending.pop())
    return this.#maximum
  }

  #visit(entry) {
    if (entry.isFunction) return

    this.#maximum = Math.max(this.#maximum, entry.depth)
    entry.addChildrenTo(this.#pending)
  }
}

class DepthEntry {
  #node
  #parentDepth
  #cachedDepth

  constructor({ node, parentDepth }) {
    this.#node = node
    this.#parentDepth = parentDepth
  }

  get isFunction() {
    return isFunction(this.#node)
  }

  addChildrenTo(pending) {
    for (const child of childNodesOf(this.#node)) {
      pending.push(new DepthEntry({ node: child, parentDepth: this.depth }))
    }
  }

  get depth() {
    return this.#cachedDepth ??= this.#parentDepth + Number(NESTING_TYPES.has(this.#node.type))
  }
}

class ExitSearch {
  #pending

  constructor(root) {
    this.#pending = root ? [ root ] : []
  }

  get hasExit() {
    while (this.#pending.length > 0) {
      if (this.#isNextAnExit) return true
    }
    return false
  }

  get #isNextAnExit() {
    const current = this.#pending.pop()
    if (isAnyExit(current)) return true

    this.#addChildrenOf(current)
    return false
  }

  #addChildrenOf(node) {
    if (node.type === "IfStatement") {
      this.#pending.push(node.consequent)
      if (node.alternate) this.#pending.push(node.alternate)
    } else if (node.type === "BlockStatement") {
      for (const child of node.body) this.#pending.push(child)
    }
  }
}

function isNegativeReturnGuard(node) {
  return isIfWithoutAlternate(node) && isNegated(node.test) && Boolean(guardReturnOf(node))
}

function isNegated(test) {
  return test.type === "UnaryExpression" && test.operator === "!"
}
