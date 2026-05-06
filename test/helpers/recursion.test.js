import assert from "node:assert/strict"
import { test } from "node:test"
import { shiftedSubjectsIn } from "#helpers/recursion"
import { ParsedCode } from "#support"

test("shiftedSubjectsIn names a parameter passed on in another position", () => {
  assert.deepEqual(shiftedIn("function walk(node, parent) { walk(node.child, node) }"), [ "node" ])
})

test("shiftedSubjectsIn gives a destructured parameter no position to shift from", () => {
  assert.deepEqual(shiftedIn("function walk({ tree }, node) { walk(node, tree) }"), [ "node" ])
})

function shiftedIn(code) {
  return shiftedSubjectsIn(new ParsedCode(code).firstNodeOfType("FunctionDeclaration"))
}
