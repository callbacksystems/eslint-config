import assert from "node:assert/strict"
import { test } from "node:test"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { hasDirectEvalIn, hasDynamicScope, hasDynamicScopeIn } from "#helpers/scope/dynamic_scope"
import { ParsedCode } from "#support"

test("hasDynamicScope finds an unshadowed bare eval call", () => {
  assert.ok(hasDynamicScope(new ParsedCode("function run() { eval('first'); eval('second') }").sourceCode))
})

test("hasDynamicScope caches its result by source", () => {
  const { sourceCode } = new ParsedCode("eval('value')")
  assert.ok(hasDynamicScope(sourceCode))
  assert.ok(hasDynamicScope(sourceCode))
})

test("hasDynamicScope rejects indirect, optional, and member eval calls", () => {
  assert.ok(!hasDynamicScope(new ParsedCode("(0, eval)('value')").sourceCode))
  assert.ok(!hasDynamicScope(new ParsedCode("eval?.('value')").sourceCode))
  assert.ok(!hasDynamicScope(new ParsedCode("globalThis.eval('value')").sourceCode))
})

test("hasDynamicScope rejects shadowed, reassigned, and with-resolved eval calls", () => {
  const shadowed = new ParsedCode("function run(eval) { eval('value') }", { sourceType: "script" })
  const reassigned = new ParsedCode("eval = replacement; eval('value')", { sourceType: "script" })
  const withScope = new ParsedCode("with ({ eval: replacement }) { eval('value') }", { sourceType: "script" })

  assert.ok(!hasDynamicScope(shadowed.sourceCode))
  assert.ok(!hasDynamicScope(reassigned.sourceCode))
  assert.ok(!hasDirectEvalIn(withScope.sourceCode, withScope.firstNodeOfType("CallExpression")))
})

test("hasDynamicScope rejects eval written before a call in the same function", () => {
  const parsed = new ParsedCode("function run() { eval = replacement; eval('value') }", { sourceType: "script" })

  assert.ok(!hasDynamicScope(parsed.sourceCode))
})

test("a conditional earlier eval write leaves a call potentially direct", () => {
  const parsed = new ParsedCode(
    "function run() { if (condition) eval = replacement; eval('value') }", { sourceType: "script" })

  assert.ok(hasDynamicScope(parsed.sourceCode))
})

test("identity-preserving logical writes leave eval direct", () => {
  const orAssignment = new ParsedCode("eval ||= replacement; eval('value')", { sourceType: "script" })
  const nullishAssignment = new ParsedCode("eval ??= replacement; eval('value')", { sourceType: "script" })

  assert.ok(hasDynamicScope(orAssignment.sourceCode))
  assert.ok(hasDynamicScope(nullishAssignment.sourceCode))
})

test("an exact self-assignment leaves eval direct", () => {
  const parsed = new ParsedCode("eval = eval; eval('value')", { sourceType: "script" })

  assert.ok(hasDynamicScope(parsed.sourceCode))
})

test("a later top-level eval reassignment does not hide an earlier direct eval", () => {
  const parsed = new ParsedCode("eval(source); eval = replacement", { sourceType: "script" })

  assert.ok(hasDynamicScope(parsed.sourceCode))
  assert.ok(hasDirectEvalIn(parsed.sourceCode, parsed.sourceCode.ast.body[0]))
})

test("an unreachable eval reassignment does not hide a direct eval", () => {
  const parsed = new ParsedCode("if (false) eval = replacement; eval(source)", { sourceType: "script" })

  assert.ok(hasDynamicScope(parsed.sourceCode))
  assert.ok(hasDirectEvalIn(parsed.sourceCode, parsed.sourceCode.ast.body[1]))
})

test("a later eval in the same execution does not intercept an earlier lookup", () => {
  const parsed = new ParsedCode(
    "function run() { let hook = () => 1; use(hook); if (condition) eval(source) }",
    { sourceType: "script" }
  )
  const identifier = parsed.nodesOfType("Identifier").findLast((node) => node.name === "hook")
  const resolver = new BindingResolver(parsed.sourceCode)

  assert.ok(!resolver.isDynamicallyResolved(identifier))
  assert.equal(resolver.functionFor(identifier).type, "ArrowFunctionExpression")
})

test("an earlier possible eval intercepts a later lookup", () => {
  const direct = lookupAfterEvalIn("eval(source); use(hook)")
  const conditional = lookupAfterEvalIn("if (condition) eval(source); use(hook)")

  assert.ok(direct.resolver.isDynamicallyResolved(direct.identifier))
  assert.ok(conditional.resolver.isDynamicallyResolved(conditional.identifier))
})

test("an unreachable eval does not create a dynamic scope", () => {
  const parsed = new ParsedCode(
    "function run() { let hook = () => 1; if (false) eval(source); use(hook) }",
    { sourceType: "script" }
  )
  const resolver = new BindingResolver(parsed.sourceCode)

  assert.ok(!hasDynamicScope(parsed.sourceCode))
  assert.ok(!resolver.isDynamicallyResolved(parsed.nodesOfType("Identifier")
    .findLast((node) => node.name === "hook")))
})

test("later source order stays unsafe across iterations and binding lifetimes", () => {
  const repeated = lookupAfterEvalIn("while (condition) { use(hook); eval(source) }")
  const persistent = new ParsedCode(
    "let hook = () => 1; function run() { use(hook); eval(source) }", { sourceType: "script" })

  assert.ok(repeated.resolver.isDynamicallyResolved(repeated.identifier))
  assert.ok(new BindingResolver(persistent.sourceCode).isDynamicallyResolved(
    persistent.nodesOfType("Identifier").findLast((node) => node.name === "hook")
  ))
})

test("an eval call before a function-local write stays potentially direct", () => {
  const parsed = new ParsedCode(
    "function run() { let hook = () => 1; eval(source); use(hook); eval = replacement }",
    { sourceType: "script" }
  )
  const identifier = parsed.nodesOfType("Identifier").findLast((node) => node.name === "hook")
  const resolver = new BindingResolver(parsed.sourceCode)

  assert.ok(hasDynamicScope(parsed.sourceCode))
  assert.ok(hasDirectEvalIn(parsed.sourceCode, identifier))
  assert.ok(resolver.isDynamicallyResolved(identifier))
  assert.equal(resolver.functionFor(identifier), null)
})

test("hasDynamicScope finds a with statement in a script", () => {
  const parsed = new ParsedCode("with (object) { consume(value) }", { sourceType: "script" })
  assert.ok(hasDynamicScope(parsed.sourceCode))
})

test("hasDynamicScopeIn limits findings to the enclosing function", () => {
  const parsed = new ParsedCode("function clean() { return value } function dynamic() { eval('value') }")
  const cleanReturn = parsed.sourceCode.ast.body[0].body.body[0]
  const dynamicReturn = parsed.sourceCode.ast.body[1].body.body[0]
  assert.ok(!hasDynamicScopeIn(parsed.sourceCode, cleanReturn))
  assert.ok(hasDynamicScopeIn(parsed.sourceCode, dynamicReturn))
  assert.ok(!hasDirectEvalIn(parsed.sourceCode, cleanReturn))
  assert.ok(hasDirectEvalIn(parsed.sourceCode, dynamicReturn))
})

test("dynamic scope propagates into closures, not into containing or sibling scopes", () => {
  const parsed = new ParsedCode(`
    const topLevel = value
    function outer() {
      const clean = value
      function nestedDynamic() { eval("value") }
      function sibling() { return value }
    }
    function dynamicOuter() {
      eval("value")
      return () => value
    }
  `)
  const identifiers = parsed.nodesOfType("Identifier").filter((node) => node.name === "value")

  assert.deepEqual(identifiers.map((node) => hasDynamicScopeIn(parsed.sourceCode, node)), [ false, false, false, true ])
  assert.deepEqual(identifiers.map((node) => hasDirectEvalIn(parsed.sourceCode, node)), [ false, false, false, true ])
})

test("direct eval shares an arguments environment with arrows but not nested regular functions", () => {
  const parsed = new ParsedCode(`
    eval("unrelated")
    const arrow = () => value
    const regular = function () { return value }
  `)
  assert.deepEqual(parsed.nodesOfType("Identifier")
    .filter((node) => node.name === "value")
    .map((node) => hasDirectEvalIn(parsed.sourceCode, node)), [ true, false ])
})

test("direct eval lookup boundaries do not cross nested regular functions", () => {
  const parsed = new ParsedCode(
    "eval(source); function clean() { let hook = () => 1; use(hook) }", { sourceType: "script" })

  assert.ok(!new BindingResolver(parsed.sourceCode).isDynamicallyResolved(
    parsed.nodesOfType("Identifier").findLast((node) => node.name === "hook")
  ))
})

test("with affects only its subtree, including closures created inside it", () => {
  const parsed = new ParsedCode(`
    function run() {
      const before = value
      with (scope) {
        consume(value)
        const later = () => value
      }
      const after = value
    }
  `, { sourceType: "script" })
  const identifiers = parsed.nodesOfType("Identifier").filter((node) => node.name === "value")

  assert.deepEqual(identifiers.map((node) => hasDynamicScopeIn(parsed.sourceCode, node)), [ false, true, true, false ])
  assert.ok(identifiers.every((node) => !hasDirectEvalIn(parsed.sourceCode, node)))
})

function lookupAfterEvalIn(statements) {
  const parsed = new ParsedCode(`function run() { let hook = () => 1; ${statements} }`, { sourceType: "script" })
  return {
    identifier: parsed.nodesOfType("Identifier").findLast((node) => node.name === "hook"),
    resolver: new BindingResolver(parsed.sourceCode)
  }
}
