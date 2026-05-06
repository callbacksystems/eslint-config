import assert from "node:assert/strict"
import { test } from "node:test"
import { negated } from "#helpers/source"
import { ParsedCode } from "#support"

test("negated drops the bang of a negation", () => {
  assert.equal(negatedIn("!ready"), "ready")
})

test("negated wraps an expression a bang alone would bind to only in part", () => {
  assert.equal(negatedIn("count > 1"), "!(count > 1)")
  assert.equal(negatedIn("ready && done"), "!(ready && done)")
})

test("negated prefixes a bang to anything else", () => {
  assert.equal(negatedIn("ready"), "!ready")
  assert.equal(negatedIn("item.ready"), "!item.ready")
})

function negatedIn(code) {
  const parsed = new ParsedCode(code)
  return negated(parsed.sourceCode, parsed.firstNodeOfType("ExpressionStatement").expression)
}
