import assert from "node:assert/strict"
import { test } from "node:test"
import { recursiveSubjectsIn } from "#helpers/functions/recursion"
import { ParsedCode } from "#support"

test("recursiveSubjectsIn names a parameter passed on in another position", () => {
  assert.deepEqual(namesIn("function walk(node, parent) { walk(node.child, node) }"), [ "node" ])
})

test("recursiveSubjectsIn gives a destructured parameter no position to shift from", () => {
  assert.deepEqual(namesIn("function walk({ tree }, node) { walk(node, tree) }"), [ "node" ])
})

test("recursiveSubjectsIn distinguishes a shadowed parameter from the recursive function's parameter", () => {
  assert.deepEqual(namesIn(`function walk(node, parent) {
    [ node ].forEach(function visit(node) { walk(parent, node) })
  }`), [ "parent" ])
})

test("recursiveSubjectsIn accepts a derived parameter only in a real self-call", () => {
  assert.deepEqual(namesIn("function walk(node, parent) { visit(node.child, node) }"), [])
  assert.deepEqual(namesIn("function walk(node) { walk(node.child) }"), [ "node" ])
})

test("recursiveSubjectsIn ignores self-calls hidden in an uninvoked nested declaration", () => {
  assert.deepEqual(namesIn("function walk(node) { function later() { walk(node.child) } }"), [])
})

test("recursiveSubjectsIn ignores self-calls hidden in deferred instance fields", () => {
  assert.deepEqual(namesIn("function walk(node) { class Later { value = walk(node.child) } }"), [])
})

test("recursiveSubjectsIn includes immediately evaluated class parts", () => {
  assert.deepEqual(namesIn("function walk(node) { class Now { static value = walk(node.child) } }"), [ "node" ])
  assert.deepEqual(namesIn("function walk(node) { class Now { [walk(node.child)]() {} } }"), [ "node" ])
})

test("recursiveSubjectsIn includes inline function bodies and parameter defaults", () => {
  assert.deepEqual(namesIn("function walk(node) { (() => walk(node.child))() }"), [ "node" ])
  assert.deepEqual(namesIn("function walk(node = walk(node.child)) {}"), [ "node" ])
})

test("recursiveSubjectsIn follows an optional member chain rooted at the recursive parameter", () => {
  assert.deepEqual(namesIn("function walk(node) { walk(node?.child) }"), [ "node" ])
})

test("recursiveSubjectsIn recognizes identifier defaults and rest parameters", () => {
  assert.deepEqual(namesIn("function walk(node = root) { walk(node.child) }"), [ "node" ])
  assert.deepEqual(namesIn("function walk(...nodes) { walk(nodes.child) }"), [ "nodes" ])
})

test("recursiveSubjectsIn does not infer positions beyond a spread argument", () => {
  assert.deepEqual(namesIn("function walk(node, parent) { walk(...children, node) }"), [])
})

function namesIn(code) {
  const parsed = new ParsedCode(code)
  return [ ...new Set(recursiveSubjectsIn(parsed.firstNodeOfType("FunctionDeclaration"), parsed.sourceCode)) ]
}
