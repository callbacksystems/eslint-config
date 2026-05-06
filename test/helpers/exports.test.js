import assert from "node:assert/strict"
import { test } from "node:test"
import { exportedBindingsIn } from "#helpers/exports"
import { dedent, ParsedCode } from "#support"

test("exportedBindingsIn leaves an anonymous default export unnamed", () => {
  assert.deepEqual(bindingsIn("export default class {}"), [ { name: null, kind: "class" } ])
})

test("exportedBindingsIn reads a listed local through its declaration", () => {
  assert.deepEqual(bindingsIn(dedent`
    const Account = class {}
    const limit = 10
    export { Account, limit }
  `), [ { name: "Account", kind: "class" }, { name: "limit", kind: "constant" } ])
})

test("exportedBindingsIn reads a name given as a string", () => {
  assert.deepEqual(bindingsIn(dedent`
    const limit = 10
    export { limit as "max limit" }
  `), [ { name: "max limit", kind: "constant" } ])
})

test("exportedBindingsIn takes an undeclared default export for a constant", () => {
  assert.deepEqual(bindingsIn("export default globalThis"), [ { name: "globalThis", kind: "constant" } ])
})

function bindingsIn(code) {
  return exportedBindingsIn(new ParsedCode(code).sourceCode).map(({ name, kind }) => ({ name, kind }))
}
