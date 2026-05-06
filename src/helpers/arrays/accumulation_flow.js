// Flow exits invalidate a manual accumulation unless they belong to a nested function. An unlabeled `break` below a
// nested `switch` only ends its case and is safe; a `switch` used directly as the candidate body does not count.

import { childNodesOf, pushReversed } from "#helpers/syntax/ast"
import { isFunction } from "#helpers/syntax/functions"
import { RangedEvents } from "#helpers/syntax/ranged_events"

const EXIT_TYPES = new Set([ "ContinueStatement", "ReturnStatement", "ThrowStatement" ])
const INDEXES_BY_ROOT = new WeakMap()

export class AccumulationFlow {
  #flows = new WeakMap()
  #functions = new WeakMap()
  #pending
  #sourceEnd

  static for(root) {
    if (!INDEXES_BY_ROOT.has(root)) INDEXES_BY_ROOT.set(root, new AccumulationFlow(root))
    return INDEXES_BY_ROOT.get(root)
  }

  constructor(root) {
    this.#pending = [ new FlowContext(root, { functionNode: root }) ]
    this.#sourceEnd = root.range[1]
    this.#index()
  }

  keepsFlowIn(body) {
    return this.#flowFor(this.#functions.get(body)).keepsFlowIn(body.range)
  }

  #index() {
    while (this.#pending.length > 0) this.#indexNext()
  }

  #indexNext() {
    const context = this.#pending.pop()
    this.#functions.set(context.node, context.functionNode)
    this.#flowFor(context.functionNode).add(context.node, { switchStart: context.switchStart })
    pushReversed(this.#pending, context.children)
  }

  #flowFor(functionNode) {
    if (!this.#flows.has(functionNode)) this.#flows.set(functionNode, new FunctionFlow(this.#sourceEnd))
    return this.#flows.get(functionNode)
  }
}

class FlowContext {
  constructor(node, { functionNode, switchStart = -1 }) {
    this.node = node
    this.functionNode = functionNode
    this.switchStart = switchStart
  }

  get children() {
    const context = this.#childContext
    return childNodesOf(this.node).map((child) => new FlowContext(child, context))
  }

  get #childContext() {
    if (isFunction(this.node)) return { functionNode: this.node }
    return {
      functionNode: this.functionNode,
      switchStart: this.node.type === "SwitchStatement" ? this.node.range[0] : this.switchStart
    }
  }
}

class FunctionFlow {
  #breaks = new RangedEvents()
  #exits = new RangedEvents()
  #sourceEnd

  constructor(sourceEnd) {
    this.#sourceEnd = sourceEnd
  }

  keepsFlowIn(range) {
    return !this.#exits.hasInside(range) && this.#keepsBreakFlowIn(range)
  }

  add(node, { switchStart }) {
    if (EXIT_TYPES.has(node.type)) this.#exits.add(node.range[0])
    else if (node.type === "BreakStatement") this.#addBreak(node, switchStart)
  }

  #keepsBreakFlowIn(range) {
    const maximumAllowed = this.#sourceEnd - range[0]
    return !this.#breaks.hasInside(range) || this.#breaks.maximumInside(range) < maximumAllowed
  }

  #addBreak(node, switchStart) {
    const switchDistance = node.label ? this.#sourceEnd + 1 : this.#sourceEnd - switchStart
    this.#breaks.add(node.range[0], switchDistance)
  }
}
