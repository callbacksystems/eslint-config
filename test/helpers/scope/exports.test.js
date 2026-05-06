import assert from "node:assert/strict"
import { test } from "node:test"
import { exportedBindingsIn, exportedVariablesIn } from "#helpers/scope/exports"
import { dedent, ParsedCode } from "#support"

test("exportedBindingsIn leaves an anonymous default export unnamed", () => {
  assert.deepEqual(bindingsIn("export default class {}"), [ { name: null, kind: "class" } ])
})

test("exportedBindingsIn classifies an anonymous default function", () => {
  assert.deepEqual(bindingsIn("export default function () {}"), [ { name: null, kind: "function" } ])
})

test("exportedBindingsIn preserves namespace and bare reexports", () => {
  assert.deepEqual(bindingsIn("export * as tools from './tools.js'"), [ { name: "tools", kind: "reexport" } ])
  assert.deepEqual(bindingsIn("export * from './tools.js'"), [ { name: null, kind: "reexport" } ])
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

test("exportedBindingsIn leaves a literal default export unnamed", () => {
  assert.deepEqual(bindingsIn("export default 3"), [ { name: null, kind: "constant" } ])
})

test("exportedBindingsIn does not expose a class expression's internal name as a local export", () => {
  const [ binding ] = exportedBindingsIn(parsedCodeOf("export default (class Internal {})").sourceCode)
  assert.equal(binding.name, null)
  assert.equal(binding.localName, null)
})

test("exportedBindingsIn does not keep a callable kind after its binding is reassigned", () => {
  assert.deepEqual(bindingsIn("let Account = class {}; Account = 1; export { Account }"), [
    { name: "Account", kind: "constant" }
  ])
  assert.deepEqual(bindingsIn("export let load = () => 1; load = 1"), [ { name: "load", kind: "constant" } ])
  assert.deepEqual(bindingsIn("export function load() {}; load = 1"), [ { name: "load", kind: "constant" } ])
  assert.deepEqual(bindingsIn("export class Account {}; Account = replacement"),
    [ { name: "Account", kind: "constant" } ])
})

test("exportedBindingsIn keeps the local name behind an export alias", () => {
  const [ binding ] = exportedBindingsIn(parsedCodeOf("class Invoice {}; export { Invoice as Charge }").sourceCode)
  assert.equal(binding.name, "Charge")
  assert.equal(binding.localName, "Invoice")
})

test("exportedVariablesIn resolves an aliased export to its local binding", () => {
  const [ exported ] = exportedVariablesIn(parsedCodeOf("function load() {}; export { load as fetch }").sourceCode)
  assert.equal(exported.name, "load")
})

function bindingsIn(code) {
  return exportedBindingsIn(parsedCodeOf(code).sourceCode).map(({ name, kind }) => ({ name, kind }))
}

function parsedCodeOf(code) {
  return new ParsedCode(code)
}
