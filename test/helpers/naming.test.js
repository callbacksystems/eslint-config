import assert from "node:assert/strict"
import { test } from "node:test"
import { leadingWordOf } from "#helpers/naming"

test("leadingWordOf is the lowercase run a camelCase name opens with", () => {
  assert.equal(leadingWordOf("fetchPrices"), "fetch")
  assert.equal(leadingWordOf("fetch"), "fetch")
})

test("leadingWordOf is empty for a name that opens with anything else", () => {
  assert.equal(leadingWordOf("_render"), "")
  assert.equal(leadingWordOf("Render"), "")
})
