import assert from "node:assert/strict"
import { test } from "node:test"
import { ThreadedReachIndex } from "#helpers/functions/threaded_reach_index"

test("memoizes reusable summaries for an acyclic value flow", () => {
  const flow = new AcyclicReach()
  const { middleSummary, rootSummary, hasStableMiddleSummary, hasStableRootFacts, unreachedSummary } = flow
  assert.deepEqual([ ...middleSummary ], [ "transform", "finish" ])
  assert.ok(hasStableMiddleSummary)
  assert.deepEqual([ ...rootSummary ], [ "route", "transform", "finish" ])
  assert.ok(hasStableRootFacts)
  assert.deepEqual([ ...unreachedSummary ], [])
})

test("caps a direct summary at the requested number of callees", () => {
  const graph = new ReachGraph()
  const root = graph.variableNamed("root")
  graph.connect({ from: root, callee: "first" })
  graph.connect({ from: root, callee: "second" })
  graph.connect({ from: root, callee: "third" })

  assert.deepEqual([ ...new ThreadedReachIndex(graph, 2).calleesFrom(root) ], [ "first", "second" ])
})

test("falls back to an iterative traversal for a cyclic value flow", () => {
  const graph = new ReachGraph()
  const root = graph.variableNamed("root")
  const middle = graph.variableNamed("middle")
  graph.connect({ from: root, to: middle, callee: "route" })
  graph.connect({ from: root, to: middle, callee: "route" })
  graph.ignoreReferenceFrom(root)
  graph.connect({ from: middle, to: root, callee: "finish" })

  assert.deepEqual([ ...new ThreadedReachIndex(graph, 4).calleesFrom(root) ], [ "route", "finish" ])
})

test("caps the iterative cycle fallback while references remain", () => {
  const graph = new ReachGraph()
  const root = graph.variableNamed("root")
  const middle = graph.variableNamed("middle")
  graph.connect({ from: root, to: middle, callee: "route" })
  graph.connect({ from: middle, to: root, callee: "finish" })
  graph.connect({ from: middle, callee: "save" })
  graph.connect({ from: middle, callee: "index" })

  assert.deepEqual([ ...new ThreadedReachIndex(graph, 3).calleesFrom(root) ], [ "route", "finish", "save" ])
})

class AcyclicReach {
  middleSummary = null

  #graph = new ReachGraph()
  #index
  #middle
  #root
  #rootFacts

  constructor() {
    this.#root = this.#graph.variableNamed("root")
    this.#middle = this.#graph.variableNamed("middle")
    const leaf = this.#graph.variableNamed("leaf")
    this.#graph.connect({ from: this.#root, to: this.#middle, callee: "route" })
    this.#graph.connect({ from: this.#middle, to: leaf, callee: "transform" })
    this.#graph.connect({ from: leaf, callee: "finish" })
    this.#index = new ThreadedReachIndex(this.#graph, 4)
    this.middleSummary = this.#index.calleesFrom(this.#middle)
    this.#rootFacts = this.#index.factsFor(this.#root)
  }

  get rootSummary() {
    return this.#index.calleesFrom(this.#root)
  }

  get hasStableMiddleSummary() {
    return this.middleSummary === this.#index.calleesFrom(this.#middle)
  }

  get hasStableRootFacts() {
    return this.#rootFacts === this.#index.factsFor(this.#root)
  }

  get unreachedSummary() {
    return this.#index.summaryFor(this.#graph.variableNamed("unreached"))
  }
}

class ReachGraph {
  #flows = new WeakMap()
  #parameters = new WeakMap()
  #variables = new Map()

  variableNamed(name) {
    if (!this.#variables.has(name)) this.#variables.set(name, { name, references: [] })
    return this.#variables.get(name)
  }

  connect({ from, to = null, callee }) {
    const reference = {}
    const functionNode = {}
    from.references.push(reference)
    this.#flows.set(reference, { callee, functionNode, position: 0 })
    this.#parameters.set(functionNode, to)
  }

  ignoreReferenceFrom(variable) {
    variable.references.push({})
  }

  flowOf(reference) {
    return this.#flows.get(reference) ?? null
  }

  parameterAt(functionNode) {
    return this.#parameters.get(functionNode) ?? null
  }
}
