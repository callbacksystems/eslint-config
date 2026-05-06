import assert from "node:assert/strict"
import { test } from "node:test"
import { collapseBlankLines, commentsIn, lineEndingOf, negated } from "#helpers/source/source"
import { ParsedCode } from "#support"

test("negated drops the bang of a negation", () => {
  assert.equal(negatedIn("!ready"), "ready")
})

test("negated wraps an expression a bang alone would bind to only in part", () => {
  assert.equal(negatedIn("count > 1"), "!(count > 1)")
  assert.equal(negatedIn("ready && done"), "!(ready && done)")
  assert.equal(negatedIn("x => x"), "!(x => x)")
  const generator = new ParsedCode("function* run() { if (yield 1) return }")
  assert.equal(negated(generator.sourceCode, generator.firstNodeOfType("YieldExpression")), "!(yield 1)")
})

test("negated prefixes a bang to anything else", () => {
  assert.equal(negatedIn("ready"), "!ready")
  assert.equal(negatedIn("item.ready"), "!item.ready")
})

test("collapseBlankLines removes an entire run in one pass", () => {
  assert.equal(collapseBlankLines("before\r\nafter"), "before\r\nafter")
  assert.equal(collapseBlankLines("before\n\n \n\t\nafter"), "before\nafter")
  assert.equal(collapseBlankLines("before\r\n\r\n \r\n\t\r\nafter"), "before\r\nafter")
  assert.equal(collapseBlankLines("before\r\r \t\rafter"), "before\rafter")
  assert.equal(collapseBlankLines("before\u{2028}\u{2028} \u{2028}after"), "before\u{2028}after")
  assert.equal(collapseBlankLines("before\u{2029}\u{2029} \u{2029}after"), "before\u{2029}after")
})

test("commentsIn finds only comments fully enclosed by the requested range", () => {
  const parsed = new ParsedCode("// before\nconst value = 1 // after\n")
  assert.deepEqual(commentsIn(parsed.sourceCode, parsed.firstNodeOfType("VariableDeclaration").range), [])
  assert.deepEqual(commentsIn(parsed.sourceCode, [ 0, parsed.sourceCode.text.length ])
    .map((comment) => comment.value.trim()), [ "before", "after" ])
})

test("lineEndingOf preserves a source file's native line ending", () => {
  assert.equal(lineEndingOf(new ParsedCode("first()\r\nsecond()\r\n").sourceCode), "\r\n")
  assert.equal(lineEndingOf(new ParsedCode("first()").sourceCode), "\n")
})

function negatedIn(code) {
  const parsed = new ParsedCode(code)
  return negated(parsed.sourceCode, parsed.firstNodeOfType("ExpressionStatement").expression)
}
