import assert from "node:assert/strict"
import { test } from "node:test"
import { isMemberRead, memberWriteOperationOf, memberWriteTargetsOf } from "#helpers/classes/member_write_targets"
import { ParsedCode } from "#support"

test("object assignment includes defaulted and rest member targets", () => {
  const parsed = new ParsedCode("({ primary: target.value = fallback, ...target.rest } = source)")
  const assignment = parsed.firstNodeOfType("AssignmentExpression")
  const targets = memberWriteTargetsOf(assignment)

  assert.deepEqual(targets.map((target) => parsed.sourceCode.getText(target)), [ "target.rest", "target.value" ])
  targets.forEach((target) => assert.equal(memberWriteOperationOf(target), assignment))
})

test("array assignment skips holes and includes defaulted and rest member targets", () => {
  const parsed = new ParsedCode("[ target.value = fallback, , ...target.rest ] = source")

  assert.deepEqual(
    memberWriteTargetsOf(parsed.firstNodeOfType("AssignmentExpression"))
      .map((target) => parsed.sourceCode.getText(target)),
    [ "target.rest", "target.value" ]
  )
})

test("an identifier update has no member write target", () => {
  const parsed = new ParsedCode("count++")
  assert.deepEqual(memberWriteTargetsOf(parsed.firstNodeOfType("UpdateExpression")), [])
})

test("a member read inside a unary expression is not a write", () => {
  const parsed = new ParsedCode("void target.value")
  assert.equal(memberWriteOperationOf(parsed.firstNodeOfType("MemberExpression")), null)
})

test("a member on an assignment's right side is not a write target", () => {
  const parsed = new ParsedCode("target.value = source.other")
  const members = parsed.nodesOfType("MemberExpression")

  assert.equal(memberWriteOperationOf(members[0]).type, "AssignmentExpression")
  assert.equal(memberWriteOperationOf(members[1]), null)
})

test("member reads distinguish read-modify-write from write-only targets", () => {
  assert.deepEqual(memberReadsIn("target.value = source"), [ false ])
  assert.deepEqual(memberReadsIn("target.value += source"), [ true ])
  assert.deepEqual(memberReadsIn("target.value++"), [ true ])
  assert.deepEqual(memberReadsIn("delete target.value"), [ false ])
  assert.deepEqual(memberReadsIn("for (target.value in source) {}"), [ false ])
  assert.deepEqual(memberReadsIn("for (target.value of source) {}"), [ false ])
  assert.deepEqual(memberReadsIn("({ value: target.value } = source)"), [ false ])
  assert.deepEqual(memberReadsIn("target.value.current = source"), [ false, true ])
})

function memberReadsIn(code) {
  return new ParsedCode(code).nodesOfType("MemberExpression").map(isMemberRead)
}
