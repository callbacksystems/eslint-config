import assert from "node:assert/strict"
import { test } from "node:test"
import {
  enclosingFunction,
  functionNameOf,
  hasOwnArgumentsAccess,
  identifierParameterNames,
  isFunction,
  isValidationGuard,
  ownNodesIn,
  parameterIdentifier
} from "#helpers/syntax/functions"
import { ParsedCode } from "#support"

test("isValidationGuard accepts a braced guard", () => {
  assert.ok(isValidationGuard(guardIn("if (!ready) { return null }")))
})

test("isFunction accepts every ESTree function node and no class member wrapper", () => {
  assert.ok(isFunction({ type: "ArrowFunctionExpression" }))
  assert.ok(isFunction({ type: "FunctionDeclaration" }))
  assert.ok(isFunction({ type: "FunctionExpression" }))
  assert.ok(!isFunction({ type: "MethodDefinition" }))
  assert.ok(!isFunction(null))
})

test("isValidationGuard accepts a guard returning undefined by name", () => {
  assert.ok(isValidationGuard(guardIn("if (!ready) return undefined")))
})

test("isValidationGuard rejects a guard returning a value", () => {
  assert.ok(!isValidationGuard(guardIn("if (!ready) return fallback")))
})

test("hasOwnArgumentsAccess follows arguments through nested arrows but stops at a regular function", () => {
  const inherited = new ParsedCode("function run() { return () => arguments[0] }")
  const rebound = new ParsedCode("function run() { return function () { return arguments[0] } }")

  assert.ok(hasOwnArgumentsAccess(inherited.firstNodeOfType("FunctionDeclaration"), inherited.sourceCode))
  assert.ok(!hasOwnArgumentsAccess(rebound.firstNodeOfType("FunctionDeclaration"), rebound.sourceCode))
})

test("hasOwnArgumentsAccess ignores property names", () => {
  const parsed = new ParsedCode("function run() { return object.arguments }")
  assert.ok(!hasOwnArgumentsAccess(parsed.firstNodeOfType("FunctionDeclaration"), parsed.sourceCode))
})

test("hasOwnArgumentsAccess enters a named function expression's body scope", () => {
  const parsed = new ParsedCode("const run = function named() { return arguments[0] }")
  assert.ok(hasOwnArgumentsAccess(parsed.firstNodeOfType("FunctionExpression"), parsed.sourceCode))
})

test("identifierParameterNames includes identifier defaults and rests", () => {
  const parsed = new ParsedCode("function run(first, second = 2, ...remaining) {}")
  assert.deepEqual(identifierParameterNames(parsed.firstNodeOfType("FunctionDeclaration").params),
    new Set([ "first", "second", "remaining" ]))
})

test("parameterIdentifier rejects defaults and rests with destructuring patterns", () => {
  const parsed = new ParsedCode("function run({ value } = {}, ...[remaining]) {}")
  const { params } = parsed.firstNodeOfType("FunctionDeclaration")

  assert.equal(parameterIdentifier(params[0]), null)
  assert.equal(parameterIdentifier(params[1]), null)
})

test("functionNameOf leaves an anonymous default declaration unnamed", () => {
  const parsed = new ParsedCode("export default function () {}")
  assert.equal(functionNameOf(parsed.firstNodeOfType("FunctionDeclaration")), null)
})

test("functionNameOf falls back to an expression's own name without a contextual identifier", () => {
  [ "const { run } = function fallback() {}", "const worker = { run: function fallback() {} }" ].forEach((code) => {
    const parsed = new ParsedCode(code)
    assert.equal(functionNameOf(parsed.firstNodeOfType("FunctionExpression")), "fallback")
  })
})

test("functionNameOf leaves an anonymous member expression unnamed", () => {
  const parsed = new ParsedCode("const worker = { run: function () {} }")
  assert.equal(functionNameOf(parsed.firstNodeOfType("FunctionExpression")), null)
})

test("functionNameOf leaves an anonymous expression assigned through a pattern unnamed", () => {
  const parsed = new ParsedCode("const { run } = function () {}")
  assert.equal(functionNameOf(parsed.firstNodeOfType("FunctionExpression")), null)
})

test("ownNodesIn includes nested function roots but prunes their bodies", () => {
  const parsed = new ParsedCode(`
    function outer() {
      const visible = 1
      function inner() { const hidden = 2 }
    }
  `)
  const nodes = ownNodesIn(parsed.firstNodeOfType("FunctionDeclaration")).toArray()

  assert.deepEqual(nodes.filter((node) => node.type === "VariableDeclarator").map((node) => node.id.name),
    [ "visible" ])
  assert.equal(nodes.filter((node) => node.type === "FunctionDeclaration").length, 1)
})

test("enclosingFunction does not consume the call stack on a deep parent chain", () => {
  const owner = { type: "FunctionDeclaration", parent: null }
  let node = owner
  for (let depth = 0; depth < 20_000; depth += 1) node = { type: "BlockStatement", parent: node }

  assert.equal(enclosingFunction({ type: "Identifier", parent: node }), owner)
})

function guardIn(statement) {
  return new ParsedCode(`function load() { ${statement} }`).firstNodeOfType("IfStatement")
}
