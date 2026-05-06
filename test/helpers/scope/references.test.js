import assert from "node:assert/strict"
import { test } from "node:test"
import { referencesIn } from "#helpers/scope/references"
import { ParsedCode } from "#support"

test("indexes exact references and scopes across shadowed bindings", () => {
  const { sourceCode } = new ParsedCode("let value = 1; function read(value) { return value } read(value)")
  const { scopeManager } = sourceCode
  const index = referencesIn(scopeManager)

  scopeManager.scopes.flatMap((scope) => scope.references).forEach((reference) => {
    assert.equal(index.get(reference.identifier), reference)
  })
  assert.equal(index.get(sourceCode.ast), undefined)
})

test("shares references within one manager while keeping parsed files isolated", () => {
  const first = new ParsedCode("read(value)").sourceCode.scopeManager
  const second = new ParsedCode("read(value)").sourceCode.scopeManager
  const index = referencesIn(first)

  assert.equal(referencesIn(first), index)
  assert.notEqual(referencesIn(second), index)
  assert.equal(index.get(second.globalScope.through[0].identifier), undefined)
})

test("collects references once and preserves the last entry for an identifier", () => {
  const sample = { identifier: { type: "Identifier", name: "value" }, reads: 0 }
  const references = [ { identifier: sample.identifier, from: {} }, { identifier: sample.identifier, from: {} } ]
  const manager = {
    scopes: [ {
      get references() {
        sample.reads += 1
        return references
      }
    } ]
  }
  assert.equal(sample.reads, 0)
  assert.equal(referencesIn(manager).get(sample.identifier), references.at(-1))
  assert.equal(referencesIn(manager).get(sample.identifier).from, references.at(-1).from)
  assert.equal(sample.reads, 1)
})
