import assert from "node:assert/strict"
import { test } from "node:test"
import { alphabetically } from "#helpers/sorting"

test("alphabetically orders by code point, so uppercase leads lowercase", () => {
  assert.deepEqual([ "b", "a", "B", "A" ].sort(alphabetically), [ "A", "B", "a", "b" ])
})

test("alphabetically holds equal strings in place", () => {
  assert.equal(alphabetically("a", "a"), 0)
})
