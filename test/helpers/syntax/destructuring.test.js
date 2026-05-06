import assert from "node:assert/strict"
import { test } from "node:test"
import { sourceOfDestructuringPattern } from "#helpers/syntax/destructuring"
import { ParsedCode } from "#support"

test("destructuring source resolves declarations and assignments", () => {
  const declaration = new ParsedCode("const { value } = source")
  const assignment = new ParsedCode("({ value } = replacement)")

  assert.equal(sourceOfDestructuringPattern(declaration.firstNodeOfType("ObjectPattern")).name, "source")
  assert.equal(sourceOfDestructuringPattern(assignment.firstNodeOfType("ObjectPattern")).name, "replacement")
})

test("destructuring source rejects patterns without a direct source", () => {
  const parameter = new ParsedCode("function read({ value }) { return value }")

  assert.equal(sourceOfDestructuringPattern(parameter.firstNodeOfType("ObjectPattern")), null)
  assert.equal(sourceOfDestructuringPattern(null), null)
})
