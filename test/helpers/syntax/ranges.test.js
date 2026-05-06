import assert from "node:assert/strict"
import { test } from "node:test"
import { contains, isWithin, isWithinTree } from "#helpers/syntax/ranges"

test("range containment includes equal boundaries and rejects partial overlaps", () => {
  const outer = { range: [ 2, 8 ] }

  assert.ok(contains(outer, { range: [ 2, 8 ] }))
  assert.ok(isWithin({ range: [ 3, 7 ] }, outer.range))
  assert.ok(!contains(outer, { range: [ 1, 7 ] }))
  assert.ok(!isWithin({ range: [ 3, 9 ] }, outer.range))
  assert.ok(!contains(null, { range: [ 3, 7 ] }))
})

test("tree containment uses identity when ranges happen to be equal", () => {
  const outer = { range: [ 0, 10 ], parent: null }
  const inner = { range: [ 0, 10 ], parent: outer }
  const unrelated = { range: [ 0, 10 ], parent: null }

  assert.ok(isWithinTree(inner, outer))
  assert.ok(isWithinTree(outer, outer))
  assert.ok(!isWithinTree(unrelated, outer))
})
