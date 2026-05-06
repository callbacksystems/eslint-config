import assert from "node:assert/strict"
import { test } from "node:test"
import { DependencyGraph } from "#helpers/flow/dependency_graph"

test("DependencyGraph walks deep chains without recursion", () => {
  const count = 20_000
  const graph = new DependencyGraph(Array.from({ length: count }, (_, index) => ({
    name: `node${index}`,
    references: index + 1 === count ? [] : [ `node${index + 1}` ]
  })))

  const names = graph.namesFrom([ "node0" ])
  assert.equal(names.length, count)
  assert.equal(names[0], "node0")
  assert.equal(names.at(-1), `node${count - 1}`)
  assert.deepEqual(graph.roots, [ "node0" ])
})

test("DependencyGraph traverses through names excluded from the result", () => {
  const graph = new DependencyGraph([
    { name: "publicEntry", references: [ "privateBridge" ] },
    { name: "privateBridge", references: [ "publicLeaf" ] },
    { name: "publicLeaf", references: [] }
  ])

  assert.deepEqual(
    graph.namesFrom([ "publicEntry" ], { select: (name) => name.startsWith("public") }),
    [ "publicEntry", "publicLeaf" ]
  )
})

test("DependencyGraph preserves first-reference order across cycles and ignores unknown seeds", () => {
  const graph = new DependencyGraph([
    { name: "first", references: [ "second", "third" ] },
    { name: "second", references: [ "first" ] },
    { name: "third", references: [] }
  ])

  assert.deepEqual(graph.namesFrom([ "unknown", "first" ]), [ "first", "second", "third" ])
  assert.deepEqual(graph.roots, [])
})
