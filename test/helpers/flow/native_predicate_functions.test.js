import assert from "node:assert/strict"
import { test } from "node:test"
import { NativePredicateFunctions } from "#helpers/flow/native_predicate_functions"
import { PredicateFunctions } from "#helpers/flow/predicate_functions"
import { ParsedCode } from "#support"

test("native predicates propagate through long forwarding chains without recursion", () => {
  const parsed = new ParsedCode(Array.from({ length: 2_500 }, forwardingFunctionAt).join("\n"))
  const analysis = new NativePredicateFunctions(parsed.sourceCode)

  assert.ok(parsed.nodesOfType("FunctionDeclaration").every((node) => analysis.includes(node)))
})

test("native predicates leave cycles without native returns unresolved", () => {
  const parsed = new ParsedCode(`
    function first(value) { return second(value) }
    function second(value) { return first(value) }
    function caller(value) { return first(value) }
  `)
  const analysis = new NativePredicateFunctions(parsed.sourceCode)

  assert.ok(parsed.nodesOfType("FunctionDeclaration").every((node) => !analysis.includes(node)))
})

test("native predicates exclude async and generator forwarding targets", () => {
  const parsed = new ParsedCode(`
    async function asyncValue(value) { return Reflect.has(value) }
    function* generatorValue(value) { return Reflect.has(value) }
    function first(value) { return asyncValue(value) }
    function second(value) { return generatorValue(value) }
  `)
  const analysis = new NativePredicateFunctions(parsed.sourceCode)

  assert.ok(parsed.nodesOfType("FunctionDeclaration").slice(2).every((node) => !analysis.includes(node)))
})

test("native predicates share analysis only within the same source", () => {
  const first = new ParsedCode("function value(input) { return Reflect.has(input, 'key') }")
  const second = new ParsedCode("Reflect.has = replacement; function value(input) { return Reflect.has(input, 'key') }")
  const analysis = new NativePredicateFunctions(first.sourceCode)

  assert.ok(new NativePredicateFunctions(first.sourceCode).includes(first.firstNodeOfType("FunctionDeclaration")))
  assert.ok(analysis.includes(first.firstNodeOfType("FunctionDeclaration")))
  assert.ok(!new NativePredicateFunctions(second.sourceCode).includes(second.firstNodeOfType("FunctionDeclaration")))
})

test("predicate names need no source analysis", () => {
  const analysis = new PredicateFunctions(null)

  assert.ok(analysis.includes(null, "isReady"))
  assert.ok(!analysis.includes(null, "value"))
})

function forwardingFunctionAt(_, index) {
  const target = index === 2_499 ? "Reflect.has" : `value${index + 1}`
  return `function value${index}(input) { return ${target}(input, "key") }`
}
