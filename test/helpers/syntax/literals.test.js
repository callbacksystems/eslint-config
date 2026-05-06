import assert from "node:assert/strict"
import { test } from "node:test"
import { isFixedPrimitive, returnsFixedLiteral, staticStringValueOf } from "#helpers/syntax/literals"
import { ParsedCode } from "#support"

test("staticStringValueOf preserves static strings including the empty string", () => {
  assert.equal(staticStringValueOf(expressionIn('"ready"')), "ready")
  assert.equal(staticStringValueOf(expressionIn('""')), "")
  assert.equal(staticStringValueOf(expressionIn("`ready`")), "ready")
  assert.equal(staticStringValueOf(expressionIn("`ready$" + "{value}`")), null)
  assert.equal(staticStringValueOf(expressionIn("1")), null)
})

test("fixed literals accept static computed primitive keys but reject external keys", () => {
  assert.ok(returnsLiteral("return { [\"ready\"]: true, [`count`]: 1, [2]: false }"))
  assert.ok(!returnsLiteral("return { [name]: true }"))
  assert.ok(!returnsLiteral("return /ready/g"))
})

test("fixed literal analysis does not consume the call stack", () => {
  let value = { type: "Literal", value: true }
  for (let depth = 0; depth < 20_000; depth += 1) value = { type: "ArrayExpression", elements: [ value ] }

  assert.ok(returnsFixedLiteral({ type: "BlockStatement", body: [ { type: "ReturnStatement", argument: value } ] }))
})

test("isFixedPrimitive stays limited to primitive expressions", () => {
  assert.ok(isFixedPrimitive(expressionIn("-1")))
  assert.ok(isFixedPrimitive(expressionIn("-1n")))
  assert.ok(isFixedPrimitive(expressionIn("~`1`")))
  assert.ok(!isFixedPrimitive(expressionIn("[]")))
  assert.ok(!isFixedPrimitive(expressionIn("+1n")))
  assert.ok(!isFixedPrimitive(expressionIn("+-1n")))
  assert.ok(!isFixedPrimitive(expressionIn("-+1n")))
})

test("fixed literal analysis rejects coercions of objects and throwing BigInt chains", () => {
  assert.ok(!returnsLiteral("return +[]"))
  assert.ok(!returnsLiteral("return { value: -{} }"))
  assert.ok(!returnsLiteral("return [ ~+1n ]"))
})

test("a missing return value is not a fixed literal", () => {
  assert.ok(!returnsLiteral("return"))
  assert.ok(returnsLiteral("return [ , 1 ]"))
})

function expressionIn(code) {
  return new ParsedCode(code).firstNodeOfType("ExpressionStatement").expression
}

function returnsLiteral(statement) {
  return returnsFixedLiteral(new ParsedCode(`function value() { ${statement} }`)
    .firstNodeOfType("FunctionDeclaration").body)
}
