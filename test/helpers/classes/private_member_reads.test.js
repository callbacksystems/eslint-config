import assert from "node:assert/strict"
import { test } from "node:test"
import { PrivateMemberReads } from "#helpers/classes/private_member_reads"
import { ParsedCode } from "#support"

test("shares private-read counts between consumers of the same tree", () => {
  const parsed = new ParsedCode("class Entry { #value; read() { return this.#value } }")
  const classNode = parsed.firstNodeOfType("ClassDeclaration")

  assert.equal(new PrivateMemberReads(parsed.sourceCode.ast).countOf(classNode, "value"), 1)
  assert.equal(new PrivateMemberReads(parsed.sourceCode.ast).countOf(classNode, "value"), 1)
})
