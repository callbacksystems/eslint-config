import assert from "node:assert/strict"
import { test } from "node:test"
import { asciiLowercaseOf } from "#helpers/strings/ascii"

test("asciiLowercaseOf folds ASCII capitals without Unicode case mappings", () => {
  assert.equal(asciiLowercaseOf("ARIA-KEYSHORTCUTS"), "aria-keyshortcuts")
  assert.equal(asciiLowercaseOf("aria-\u{212A}eyshortcuts"), "aria-\u{212A}eyshortcuts")
})

test("asciiLowercaseOf preserves a missing value", () => {
  assert.equal(asciiLowercaseOf(), null)
})
