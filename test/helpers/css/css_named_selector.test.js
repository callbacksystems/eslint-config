import assert from "node:assert/strict"
import { test } from "node:test"
import { CssNamedSelector } from "#helpers/css/css_named_selector"

test("top-level comments do not hide a matching meta selector", () => {
  assert.ok(new CssNamedSelector("/* lead */meta[name='csrf-token']", { name: "csrf-token" }).hasMeta)
})

test("parenthesized text outside a pseudo is not treated as a selector", () => {
  assert.ok(!new CssNamedSelector("(meta[name='csrf-token'])", { name: "csrf-token" }).hasMeta)
})

test("quoted text outside a pseudo is not treated as a selector", () => {
  assert.ok(!new CssNamedSelector("'meta[name=csrf-token]' ", { name: "csrf-token" }).hasMeta)
})

test("nth formulas without an of clause preserve the current compound", () => {
  [
    "meta[name='csrf-token']:nth-child(2n + 1)",
    "meta[name='csrf-token']:nth-child(2n + 1",
    "meta[name='csrf-token']:nth-child(2n odd)"
  ].forEach((selector) => assert.ok(new CssNamedSelector(selector, { name: "csrf-token" }).hasMeta))
})

test("nested syntax in a malformed nth formula cannot surface selector decoys", () => {
  [
    ":nth-child(calc(meta[name=csrf-token]))",
    ":nth-child([meta[name=csrf-token]])",
    ":nth-child(\"meta[name=csrf-token]\")"
  ].forEach((selector) => assert.ok(!new CssNamedSelector(selector, { name: "csrf-token" }).hasMeta))
})
