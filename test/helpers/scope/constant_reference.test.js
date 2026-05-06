import assert from "node:assert/strict"
import { test } from "node:test"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ConstantReference } from "#helpers/scope/constant_reference"
import { ParsedCode } from "#support"

test("constant references expose the initializer of a lexical const declaration", () => {
  assert.equal(referenceIn("const values = [1]; for (const item of values) use(item)").initializer.type,
    "ArrayExpression")
  assert.equal(referenceIn("const values = new Set(); for (const item of values) use(item)").initializer.type,
    "NewExpression")
  assert.equal(referenceIn("let values = [1]; for (const item of values) use(item)").initializer, null)
  assert.equal(referenceIn("for (const item of values) use(item)").initializer, null)
  assert.equal(referenceIn("for (const item of [1]) use(item)").initializer, null)
})

test("constant references reject dynamic lookup inside with", () => {
  assert.equal(referenceIn("const values = [1]; with (scope) { for (const item of values) use(item) }",
    { sourceType: "script" }).initializer, null)
})

test("constant references distinguish the loop read from earlier observations", () => {
  assert.ok(isOnlyLoopReferenceIn("const values = [1]; for (const item of values) use(item)"))
  assert.ok(!isOnlyLoopReferenceIn("const values = [1]; use(values); for (const item of values) use(item)"))
  assert.ok(isOnlyLoopReferenceIn("const values = [1]; for (const item of values) use(item); use(values)"))
})

function referenceIn(code, options) {
  const parsed = new ParsedCode(code, options)
  return new ConstantReference(parsed.firstNodeOfType("ForOfStatement").right, BindingResolver.for(parsed.sourceCode))
}

function isOnlyLoopReferenceIn(code) {
  const parsed = new ParsedCode(code)
  const loop = parsed.firstNodeOfType("ForOfStatement")
  return new ConstantReference(loop.right, BindingResolver.for(parsed.sourceCode)).isOnlyReferenceBefore(loop)
}
