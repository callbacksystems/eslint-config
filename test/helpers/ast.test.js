import assert from "node:assert/strict"
import { test } from "node:test"
import { isProvablyBoolean } from "#helpers/ast"
import { ParsedCode } from "#support"

test("isProvablyBoolean accepts a boolean literal and a negation", () => {
  assert.ok(isProvablyBoolean(expressionIn("true")))
  assert.ok(isProvablyBoolean(expressionIn("!ready")))
  assert.ok(!isProvablyBoolean(expressionIn("1")))
  assert.ok(!isProvablyBoolean(expressionIn("-count")))
})

test("isProvablyBoolean accepts a comparison and a Boolean call", () => {
  assert.ok(isProvablyBoolean(expressionIn("count > 1")))
  assert.ok(isProvablyBoolean(expressionIn("Boolean(value)")))
  assert.ok(!isProvablyBoolean(expressionIn("count + 1")))
  assert.ok(!isProvablyBoolean(expressionIn("String(value)")))
})

test("isProvablyBoolean accepts a logical or conditional expression whose branches all are", () => {
  assert.ok(isProvablyBoolean(expressionIn("count > 1 && !ready")))
  assert.ok(isProvablyBoolean(expressionIn("ready ? count > 1 : !done")))
  assert.ok(!isProvablyBoolean(expressionIn("ready && count")))
  assert.ok(!isProvablyBoolean(expressionIn("ready ? count : !done")))
})

test("isProvablyBoolean rejects a bare reference and no node at all", () => {
  assert.ok(!isProvablyBoolean(expressionIn("ready")))
  assert.ok(!isProvablyBoolean(null))
})

function expressionIn(code) {
  return new ParsedCode(code).firstNodeOfType("ExpressionStatement").expression
}
