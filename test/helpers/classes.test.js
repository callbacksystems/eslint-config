import assert from "node:assert/strict"
import { test } from "node:test"
import { enclosingClass, keyName, propertyNameOf } from "#helpers/classes"
import { ParsedCode } from "#support"

test("enclosingClass is null outside any class", () => {
  assert.equal(enclosingClass(new ParsedCode("function clear() {}").firstNodeOfType("FunctionDeclaration")), null)
})

test("keyName is null for a key that is not an identifier", () => {
  assert.equal(keyName(methodKeyIn("class Counter { #count() {} }")), "count")
  assert.equal(keyName(methodKeyIn("class Counter { \"count\"() {} }")), null)
})

test("propertyNameOf is empty for a property that is not an identifier", () => {
  assert.equal(propertyNameOf(new ParsedCode("this.reset()").firstNodeOfType("MemberExpression")), "reset")
  assert.equal(propertyNameOf(new ParsedCode("this[\"reset\"]()").firstNodeOfType("MemberExpression")), "")
})

function methodKeyIn(code) {
  return new ParsedCode(code).firstNodeOfType("MethodDefinition").key
}
