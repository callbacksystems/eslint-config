import assert from "node:assert/strict"
import { test } from "node:test"
import { CallArguments } from "#helpers/functions/call_arguments"
import { ParsedCode } from "#support"

test("call arguments index positions once and reject positions at or after a spread", () => {
  const call = new ParsedCode("call(before, ...first, ...second, after)").firstNodeOfType("CallExpression")
  const [ before, first, second, after ] = call.arguments
  const argumentsList = new CallArguments(call)

  assert.equal(argumentsList.positionOf(before), 0)
  assert.equal(argumentsList.positionOf(call.callee), -1)
  assert.equal(argumentsList.stablePositionOf(before), 0)
  assert.equal(argumentsList.stablePositionOf(first), -1)
  assert.equal(argumentsList.stablePositionOf(second), -1)
  assert.equal(argumentsList.stablePositionOf(after), -1)
})

test("call arguments treat every position as stable when there is no spread", () => {
  const parsed = new ParsedCode("call(first, second)")
  const call = parsed.firstNodeOfType("CallExpression")
  const argumentsList = new CallArguments(call)

  assert.equal(argumentsList.stablePositionOf(call.arguments[1]), 1)
})
