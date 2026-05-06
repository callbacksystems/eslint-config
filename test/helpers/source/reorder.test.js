import assert from "node:assert/strict"
import { test } from "node:test"
import { reorderFix } from "#helpers/source/reorder"
import { ParsedCode } from "#support"

test("reorderFix does not mistake one CRLF for a blank line", () => {
  assert.equal(reordered("const second = 2\r\nconst first = 1"), "const first = 1\r\nconst second = 2")
})

test("reorderFix preserves a real CRLF blank line", () => {
  assert.equal(reordered("const second = 2\r\n\r\nconst first = 1"), "const first = 1\r\n\r\nconst second = 2")
})

test("reorderFix is withheld when moving a next-statement directive would retarget it", () => {
  const code = "function f() {} // eslint-disable-next-line no-undef\nconst X = hiddenGlobal()"
  const parsed = new ParsedCode(code)
  const declarations = [ ...parsed.nodesOfType("FunctionDeclaration"), ...parsed.nodesOfType("VariableDeclaration") ]
  assert.equal(reorderFix(parsed.sourceCode, { from: declarations, to: declarations.toReversed() }), null)
})

function reordered(code) {
  const parsed = new ParsedCode(code)
  const declarations = parsed.nodesOfType("VariableDeclaration")
  return reorderFix(parsed.sourceCode, { from: declarations, to: declarations.toReversed() })({
    replaceTextRange: (_range, text) => text
  })
}
