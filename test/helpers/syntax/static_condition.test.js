import assert from "node:assert/strict"
import { test } from "node:test"
import { StaticCondition } from "#helpers/syntax/static_condition"
import { ParsedCode } from "#support"

test("static conditions negate only statically known truthiness", () => {
  assert.equal(staticValueOf("!true"), false)
  assert.equal(staticValueOf("!!0"), false)
  assert.equal(staticValueOf("!``"), true)
  assert.equal(staticValueOf("!value"), null)
})

test("static conditions do not recurse through negations", () => {
  assert.equal(new StaticCondition(
    Array.from({ length: 10_000 }).reduce(negationOf, { type: "Literal", value: true })
  ).value, true)
})

function staticValueOf(expression) {
  const parsed = new ParsedCode(`const result = ${expression}`)
  return new StaticCondition(parsed.firstNodeOfType("VariableDeclarator").init).value
}

function negationOf(argument) {
  return { type: "UnaryExpression", operator: "!", argument }
}
