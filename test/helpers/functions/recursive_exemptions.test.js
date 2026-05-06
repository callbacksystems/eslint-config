import assert from "node:assert/strict"
import { test } from "node:test"
import { RecursiveExemptions } from "#helpers/functions/recursive_exemptions"
import { ParsedCode } from "#support"

test("recursive exemptions follow the cursor through local calls without leaking by name", () => {
  const parsed = new ParsedCode(`
    function walk(node, parent) {
      visit(node, parent)
      walk(node.left, node)
    }
    function visit(entry, ancestor) { inspect(entry, ancestor) }
    function inspect(value, owner) { return value === owner }
    function unrelated(node, parent) { return node === parent }
  `)
  const [ walk, visit, inspect, unrelated ] = parsed.nodesOfType("FunctionDeclaration")
  const exemptions = new RecursiveExemptions([ walk, visit, inspect, unrelated ], parsed.sourceCode)

  assert.deepEqual(exemptions.namesFor(walk), new Set([ "node", "parent" ]))
  assert.deepEqual(exemptions.namesFor(visit), new Set([ "ancestor", "entry" ]))
  assert.deepEqual(exemptions.namesFor(inspect), new Set([ "owner", "value" ]))
  assert.deepEqual(exemptions.namesFor(unrelated), new Set())
})

test("recursive exemptions follow defaulted parameters but not unstable spread positions", () => {
  const parsed = new ParsedCode(`
    function walk(node) {
      defaulted(node)
      spread(...node)
      walk(node.child)
    }
    function defaulted(entry = null) { return entry }
    function spread(entry) { return entry }
  `)
  const [ walk, defaulted, spread ] = parsed.nodesOfType("FunctionDeclaration")
  const exemptions = new RecursiveExemptions([ walk, defaulted, spread ], parsed.sourceCode)

  assert.deepEqual(exemptions.namesFor(defaulted), new Set([ "entry" ]))
  assert.deepEqual(exemptions.namesFor(spread), new Set())
})

test("recursive exemptions recognize rest cursors without equating them to collected arguments", () => {
  const parsed = new ParsedCode(`
    function walk(...nodes) {
      inspect(nodes)
      walk(nodes.child)
    }
    function inspect(entries) { return entries }
    function visit(node) {
      collect(node)
      visit(node.child)
    }
    function collect(...entries) { return entries }
  `)
  const [ walk, inspect, visit, collect ] = parsed.nodesOfType("FunctionDeclaration")
  const exemptions = new RecursiveExemptions([ walk, inspect, visit, collect ], parsed.sourceCode)

  assert.deepEqual(exemptions.namesFor(walk), new Set([ "nodes" ]))
  assert.deepEqual(exemptions.namesFor(inspect), new Set([ "entries" ]))
  assert.deepEqual(exemptions.namesFor(collect), new Set())
})

test("recursive exemptions keep argument positions before a spread stable", () => {
  const parsed = new ParsedCode(`
    function walk(node, rest) {
      inspect(node, ...rest, node)
      walk(node.child, rest)
    }
    function inspect(before, values, after) { return before ?? after ?? values }
  `)
  const [ walk, inspect ] = parsed.nodesOfType("FunctionDeclaration")
  const exemptions = new RecursiveExemptions([ walk, inspect ], parsed.sourceCode)

  assert.deepEqual(exemptions.namesFor(inspect), new Set([ "before" ]))
})

test("recursive exemptions index positions shared by many cursor arguments", () => {
  const parsed = parsedWithManyCursorArguments(500)
  const [ walk, inspect ] = parsed.nodesOfType("FunctionDeclaration")
  const exemptions = new RecursiveExemptions([ walk, inspect ], parsed.sourceCode)

  assert.equal(exemptions.namesFor(inspect).size, 500)
})

function parsedWithManyCursorArguments(count) {
  const names = Array.from({ length: count }, (_, index) => `cursor${index}`)
  return new ParsedCode(`
    function walk(${names}) {
      inspect(${names})
      walk(${names.map((name) => `${name}.child`)})
    }
    function inspect(${names}) {}
  `)
}
