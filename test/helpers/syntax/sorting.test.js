import assert from "node:assert/strict"
import { test } from "node:test"
import { alphabetically, byNodePosition, byPosition } from "#helpers/syntax/sorting"

test("alphabetically orders by code point, so uppercase leads lowercase", () => {
  assert.deepEqual([ "b", "a", "B", "A" ].sort(alphabetically), [ "A", "B", "a", "b" ])
})

test("alphabetically holds equal strings in place", () => {
  assert.equal(alphabetically("a", "a"), 0)
})

test("byPosition orders ranged values by their source start", () => {
  assert.deepEqual([ { range: [ 8, 9 ] }, { range: [ 2, 7 ] } ].sort(byPosition),
    [ { range: [ 2, 7 ] }, { range: [ 8, 9 ] } ])
})

test("byNodePosition orders descriptors by their node's source start", () => {
  const later = { node: { range: [ 8, 9 ] } }
  const earlier = { node: { range: [ 2, 7 ] } }

  assert.deepEqual([ later, earlier ].sort(byNodePosition), [ earlier, later ])
})
