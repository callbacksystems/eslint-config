import assert from "node:assert/strict"
import { test } from "node:test"
import { PreviousStatements } from "#helpers/syntax/previous_statements"
import { ParsedCode } from "#support"

test("indexes previous statements in blocks and switch cases", () => {
  const parsed = new ParsedCode("{ first(); second() } switch (kind) { case 1: third(); fourth() }")
  const [ first, second, third, fourth ] = parsed.nodesOfType("ExpressionStatement")
  const statements = new PreviousStatements()

  assert.equal(statements.before(first), null)
  assert.equal(statements.before(second), first)
  assert.equal(statements.before(third), null)
  assert.equal(statements.before(fourth), third)
})

test("returns null outside a statement list", () => {
  const parsed = new ParsedCode("if (ready) work()")
  const [ statement ] = parsed.nodesOfType("ExpressionStatement")

  assert.equal(new PreviousStatements().before(statement), null)
})

test("indexes many sibling loops in one pass", () => {
  const count = 4_000
  const loops = new ParsedCode(Array.from(
    { length: count }, (_, index) => `for (const x${index} of [ ${index} ]) use(x${index})`
  ).join("\n")).nodesOfType("ForOfStatement")
  const statements = new PreviousStatements()

  assert.equal(statements.before(loops[0]), null)
  loops.slice(1).forEach((loop, index) => assert.equal(statements.before(loop), loops[index]))
})
