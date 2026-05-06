import assert from "node:assert/strict"
import { test } from "node:test"
import { FunctionSubject } from "#helpers/functions/function_subject"
import { ModuleView } from "#helpers/flow/module_view"
import { ParsedCode } from "#support"

test("isEligible rejects async and generator functions whose wrappers change the returned value", () => {
  assert.ok(subjectIn("function value() { return 1 }").isEligible)
  assert.ok(!subjectIn("async function value() { return 1 }").isEligible)
  assert.ok(!subjectIn("function* value() { return 1 }").isEligible)
})

function subjectIn(code) {
  const parsed = new ParsedCode(code)
  return new FunctionSubject(parsed.firstNodeOfType("FunctionDeclaration"), new ModuleView(parsed.sourceCode))
}
