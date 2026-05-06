import assert from "node:assert/strict"
import { test } from "node:test"
import { ruleSourcePathOf } from "#helpers/eslint/rule_source"

test("ruleSourcePathOf maps rule ids to their source paths", () => {
  assert.equal(ruleSourcePathOf("prefer-for-each"), "src/rules/prefer_for_each.js")
  assert.equal(ruleSourcePathOf("browser/no-class-selector"), "src/rules/browser/no_class_selector.js")
})
