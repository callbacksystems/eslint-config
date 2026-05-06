import assert from "node:assert/strict"
import { test } from "node:test"
import { ExecutedCalls } from "#helpers/functions/executed_calls"
import { ParsedCode } from "#support"

test("indexes calls by their actual function execution", () => {
  const parsed = new ParsedCode(`
    function outer() {
      direct()
      function deferred(value = defaulted()) { inside() }
      run(() => inline())
      (() => immediate())()
      class Subject extends base() {
        [key()]() { method() }
        [computed()] = deferredComputedValue()
        field = deferredField()
        static field = staticField()
        static { staticBlock() }
      }
    }
  `)
  const [ outer, deferred ] = parsed.nodesOfType("FunctionDeclaration")
  const calls = new ExecutedCalls(parsed.sourceCode)

  assert.deepEqual(identifierCalleesIn(calls.callsIn(outer)), [
    "direct", "run", "inline", "immediate", "base", "key", "computed", "staticField", "staticBlock"
  ])
  assert.deepEqual(identifierCalleesIn(calls.callsIn(deferred)), [ "defaulted", "inside" ])
})

test("shares its source index and returns an empty list for a function without calls", () => {
  const parsed = new ParsedCode("function present() { work() } function empty() {}")
  const [ present, empty ] = parsed.nodesOfType("FunctionDeclaration")

  assert.strictEqual(
    new ExecutedCalls(parsed.sourceCode).callsIn(present),
    new ExecutedCalls(parsed.sourceCode).callsIn(present)
  )
  assert.deepEqual(new ExecutedCalls(parsed.sourceCode).callsIn(empty), [])
})

test("indexes deeply nested inline calls without eagerly copying them into every ancestor", () => {
  const fixture = new NestedInlineCalls(20_000)
  const calls = new ExecutedCalls(fixture.sourceCode)

  assert.equal(calls.callsIn(fixture.root).length, 40_000)
  assert.strictEqual(calls.callsIn(fixture.root), calls.callsIn(fixture.root))
})

function identifierCalleesIn(calls) {
  return calls.filter((call) => call.callee.type === "Identifier").map((call) => call.callee.name)
}

class NestedInlineCalls {
  #ast

  constructor(depth) {
    this.#ast = programWith(rootAt(depth))
    linkParents(this.#ast)
  }

  get root() {
    return this.#ast.body[0]
  }

  get sourceCode() {
    return { ast: this.#ast }
  }
}

function programWith(root) {
  return node("Program", { body: [ root ] })
}

function node(type, properties) {
  return { type, ...properties }
}

function rootAt(depth) {
  return node("FunctionDeclaration", {
    id: null,
    params: [],
    body: node("BlockStatement", { body: [ nestedAt(depth) ] })
  })
}

function nestedAt(depth) {
  return Array.from({ length: depth }).reduce((nested) => inlineAround(nested), null)
}

function inlineAround(nested) {
  return node("CallExpression", { callee: inlineArrowAround(nested), arguments: [] })
}

function inlineArrowAround(nested) {
  return node("ArrowFunctionExpression", { params: [], body: inlineBodyAround(nested) })
}

function inlineBodyAround(nested) {
  return node("BlockStatement", { body: [ workCall(), nested ].filter(Boolean) })
}

function workCall() {
  return node("CallExpression", { callee: node("Identifier", { name: "work" }), arguments: [] })
}

function linkParents(root) {
  const pending = [ root ]
  while (pending.length > 0) linkChildrenOf(pending.pop(), pending)
}

function linkChildrenOf(parent, pending) {
  Object.entries(parent).filter(([ key ]) => key !== "parent")
    .flatMap(([ , value ]) => Array.isArray(value) ? value : [ value ])
    .filter((child) => child?.type)
    .forEach((child) => {
      child.parent = parent
      pending.push(child)
    })
}
