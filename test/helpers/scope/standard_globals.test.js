import assert from "node:assert/strict"
import { test } from "node:test"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { StandardGlobals } from "#helpers/scope/standard_globals"
import { ParsedCode } from "#support"

test("matches a global value captured before its binding is replaced", () => {
  const parsed = new ParsedCode("const NativeHeaders = Headers; "
    + "globalThis.Headers = FakeHeaders; new NativeHeaders()")

  assert.ok(standardGlobalsIn(parsed).matches(parsed.firstNodeOfType("NewExpression").callee, "Headers"))
})

test("rejects a global value captured after its binding is replaced", () => {
  const parsed = new ParsedCode("globalThis.Headers = FakeHeaders; "
    + "const NativeHeaders = Headers; new NativeHeaders()")

  assert.ok(!standardGlobalsIn(parsed).matches(parsed.firstNodeOfType("NewExpression").callee, "Headers"))
})

function standardGlobalsIn(parsed) {
  return new StandardGlobals(new BindingResolver(parsed.sourceCode))
}
