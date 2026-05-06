import assert from "node:assert/strict"
import { test } from "node:test"
import { BooleanReturnAnalysis } from "#helpers/flow/boolean_return_analysis"
import { ParsedCode } from "#support"

test("boolean return analysis handles a long dependency chain without recursion", () => {
  const parsed = new ParsedCode(chainOfLength(2_500))

  assert.ok(new BooleanReturnAnalysis(parsed.sourceCode)
    .returnsBooleanFrom(parsed.firstNodeOfType("FunctionDeclaration")))
})

test("boolean return analysis handles a deeply nested boolean expression without recursion", () => {
  const parsed = new ParsedCode(`function value() { return ${"true && ".repeat(2_500)}true }`)

  assert.ok(new BooleanReturnAnalysis(parsed.sourceCode)
    .returnsBooleanFrom(parsed.firstNodeOfType("FunctionDeclaration")))
})

test("boolean return analysis batches broad dependency invalidations", () => {
  const parsed = new ParsedCode(broadDependencyFanIn(750))

  assert.ok(new BooleanReturnAnalysis(parsed.sourceCode)
    .returnsBooleanFrom(parsed.firstNodeOfType("FunctionDeclaration")))
})

test("boolean return analysis does not rescan deferred return functions", () => {
  const parsed = new ParsedCode(`function value() { return ${nestedArrows(200)} }`)

  assert.ok(!new BooleanReturnAnalysis(parsed.sourceCode)
    .returnsBooleanFrom(parsed.firstNodeOfType("FunctionDeclaration")))
})

test("boolean return analysis follows syntax that preserves the returned value", () => {
  const parsed = new ParsedCode(`
    async function source() { return true }
    async function awaited() { return await source() }
    function assigned() { return value = true }
    function sequenced() { return (effect(), true) }
  `)
  const analysis = new BooleanReturnAnalysis(parsed.sourceCode)

  assert.ok(parsed.nodesOfType("FunctionDeclaration").every((node) => analysis.returnsBooleanFrom(node)))
})

test("boolean return analysis keeps the undefined branch of optional chaining", () => {
  const parsed = new ParsedCode("function result(value) { return value?.isReady() }")

  assert.ok(!new BooleanReturnAnalysis(parsed.sourceCode)
    .returnsBooleanFrom(parsed.firstNodeOfType("FunctionDeclaration")))
})

test("boolean return analysis does not treat an unawaited async call as a boolean", () => {
  const parsed = new ParsedCode(`
    async function source() { return true }
    function result() { return source() }
  `)
  const analysis = new BooleanReturnAnalysis(parsed.sourceCode)

  assert.ok(!analysis.returnsBooleanFrom(parsed.nodesOfType("FunctionDeclaration")[1]))
})

test("boolean return analysis does not unwrap an assignment that changes the value's type", () => {
  const parsed = new ParsedCode("function result() { return value += true }")

  assert.ok(!new BooleanReturnAnalysis(parsed.sourceCode)
    .returnsBooleanFrom(parsed.firstNodeOfType("FunctionDeclaration")))
})

test("boolean return analysis includes the implicit undefined path", () => {
  const parsed = new ParsedCode("function result(ready) { if (ready) return true }")

  assert.ok(!new BooleanReturnAnalysis(parsed.sourceCode)
    .returnsBooleanFrom(parsed.firstNodeOfType("FunctionDeclaration")))
})

test("boolean return analysis requires a reachable boolean return", () => {
  const parsed = new ParsedCode("function status() { throw Error(); return true }")

  assert.ok(!new BooleanReturnAnalysis(parsed.sourceCode)
    .returnsBooleanFrom(parsed.firstNodeOfType("FunctionDeclaration")))
})

function chainOfLength(length) {
  return Array.from({ length }, (_, index) => index === length - 1
    ? `function value${index}() { return true }`
    : `function value${index}() { return value${index + 1}() }`).join("\n")
}

function broadDependencyFanIn(count) {
  return `function value(input) { switch (input) {
    ${Array.from({ length: count }, dependencyCaseAt).join("\n")}
    default: return true
  } }
  ${Array.from({ length: count }, numberDependencyAt).join("\n")}`
}

function dependencyCaseAt(_, index) {
  return `case ${index}: return (number${index}(), true)`
}

function numberDependencyAt(_, index) {
  return `function number${index}() { return ${index} }`
}

function nestedArrows(count) {
  return `${"() => (".repeat(count)}true${")".repeat(count)}`
}
