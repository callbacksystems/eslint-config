import assert from "node:assert/strict"
import { test } from "node:test"
import { ArrayEvidence } from "#helpers/arrays/array_evidence"
import { NativeBooleanCall } from "#helpers/flow/native_boolean_call"
import { ParsedCode } from "#support"

test("native boolean contracts require a known member and confined receiver", () => {
  [
    [ "unknown()", false ],
    [ "receiver[method]()", false ],
    [ "receiver.has(value)", false ],
    [ "Reflect.has(target, key)", true ],
    [ "const items = []; consume(items); items.some(Boolean)", false ],
    [ "const items = []; items.length; items.includes(value)", true ],
    [ "const items = []; items[method](); items.includes(value)", false ],
    [ "const items = []; items.some(Boolean); items.includes(value)", true ],
    [ "const items = []; items.length(); items.includes(value)", false ]
  ].forEach(([ code, expected ]) => {
    const call = nativeCallIn(code)
    assert.equal(call.hasBooleanContract, expected, code)
    assert.equal(call.isBoolean, expected, code)
  })
})

test("RegExp contracts distinguish present flags from possibly reused patterns", () => {
  [
    [ "RegExp(pattern, 'g')", true ],
    [ "const flags = 'g'; RegExp(pattern, flags)", true ],
    [ "RegExp(pattern, flags)", false ],
    [ "RegExp(pattern, `g`)", true ],
    [ "RegExp(pattern, typeof flags)", true ],
    [ "RegExp(pattern, void flags)", false ],
    [ "RegExp(`x`)", true ],
    [ "RegExp(typeof value)", true ],
    [ "RegExp(pattern)", false ],
    [ "const pattern = 'x'; RegExp(pattern)", true ],
    [ "RegExp()", true ]
  ].forEach(([ receiver, expected ]) => {
    assert.equal(nativeCallIn(`${receiver}.test('x')`).hasBooleanContract, expected, receiver)
  })
})

function nativeCallIn(code) {
  const parsed = new ParsedCode(code)
  const arrays = new ArrayEvidence(parsed.sourceCode)
  return new NativeBooleanCall(parsed.sourceCode.ast.body.at(-1).expression, { arrays, bindings: arrays.bindings })
}
