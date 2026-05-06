import assert from "node:assert/strict"
import { test } from "node:test"
import { isValidationGuard } from "#helpers/functions"
import { ParsedCode } from "#support"

test("isValidationGuard accepts a braced guard", () => {
  assert.ok(isValidationGuard(guardIn("if (!ready) { return null }")))
})

test("isValidationGuard accepts a guard returning undefined by name", () => {
  assert.ok(isValidationGuard(guardIn("if (!ready) return undefined")))
})

test("isValidationGuard rejects a guard returning a value", () => {
  assert.ok(!isValidationGuard(guardIn("if (!ready) return fallback")))
})

function guardIn(statement) {
  return new ParsedCode(`function load() { ${statement} }`).firstNodeOfType("IfStatement")
}
