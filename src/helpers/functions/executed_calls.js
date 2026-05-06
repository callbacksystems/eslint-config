// Index calls by the function executions they belong to. Deferred function and instance-field bodies start a new
// execution context; inline callbacks/IIFEs also belong to their enclosing execution. Class heritage, computed keys,
// static fields and static blocks stay in the enclosing context because defining the class evaluates them immediately.

import { childNodesOf, pushReversed } from "#helpers/syntax/ast"
import { isFunction, isInlineFunction } from "#helpers/syntax/functions"

const indexesBySourceCode = new WeakMap()

export class ExecutedCalls {
  #index

  constructor(sourceCode) {
    if (!indexesBySourceCode.has(sourceCode)) {
      indexesBySourceCode.set(sourceCode, new ExecutedCallIndex(sourceCode.ast))
    }
    this.#index = indexesBySourceCode.get(sourceCode)
  }

  callsIn(functionNode) {
    return this.#index.callsIn(functionNode)
  }
}

class ExecutedCallIndex {
  #calls = new WeakMap()
  #pending

  constructor(root) {
    this.#pending = [ new ExecutionFrame(root) ]
    this.#build()
  }

  callsIn(functionNode) {
    return this.#callsFor(functionNode).all
  }

  #build() {
    while (this.#pending.length > 0) this.#index(this.#pending.pop())
  }

  #index(frame) {
    if (isFunction(frame.node)) this.#addFunction(frame)
    if (frame.node.type === "CallExpression" && frame.execution) {
      this.#callsFor(frame.execution).addCall(frame.node)
    }
    pushReversed(this.#pending, frame.children)
  }

  #addFunction(frame) {
    if (frame.execution && isInlineFunction(frame.node)) {
      this.#callsFor(frame.execution).addInline(this.#callsFor(frame.node))
    } else {
      this.#callsFor(frame.node)
    }
  }

  #callsFor(functionNode) {
    if (!this.#calls.has(functionNode)) this.#calls.set(functionNode, new ExecutionCalls())
    return this.#calls.get(functionNode)
  }
}

class ExecutionFrame {
  constructor(node, execution = null) {
    this.node = node
    this.execution = execution
  }

  get children() {
    const execution = isFunction(this.node) ? this.node : this.execution
    return childNodesOf(this.node).map((child) =>
      new ExecutionFrame(child, this.#isDeferredInstanceFieldValue(child) ? null : execution))
  }

  #isDeferredInstanceFieldValue(child) {
    return this.node.type === "PropertyDefinition" && !this.node.static && child === this.node.value
  }
}

class ExecutionCalls {
  #events = []
  #cachedAll

  addCall(call) {
    this.#events.push(call)
  }

  addInline(calls) {
    this.#events.push(calls)
  }

  get all() {
    return this.#cachedAll ??= this.#collected
  }

  get #collected() {
    return [ ...this.#callsInOrder() ]
  }

  *#callsInOrder() {
    const pending = this.#events.toReversed()
    while (pending.length > 0) {
      const event = pending.pop()
      if (event instanceof ExecutionCalls) event.#appendTo(pending)
      else yield event
    }
  }

  #appendTo(pending) {
    pushReversed(pending, this.#events)
  }
}
