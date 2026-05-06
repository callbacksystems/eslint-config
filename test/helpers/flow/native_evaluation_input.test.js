import assert from "node:assert/strict"
import { test } from "node:test"
import { NativeEvaluationInput } from "#helpers/flow/native_evaluation_input"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { dedent, ParsedCode } from "#support"

test("native inputs distinguish nullish values, strings, and coercion results", () => {
  [
    [ "null", [ true, true, false ] ],
    [ "undefined", [ true, true, false ] ],
    [ "void value", [ true, true, false ] ],
    [ "const empty = void value; empty", [ true, true, false ] ],
    [ "!value", [ true, false, false ] ],
    [ "typeof value", [ true, false, false ] ],
    [ "+value", [ false, false, false ] ],
    [ "1", [ true, false, false ] ],
    [ "'text'", [ true, false, true ] ],
    [ "`text`", [ true, false, true ] ],
    [ dedent`${"`"}text${"$"}{value}${"`"}`, [ false, false, false ] ],
    [ "value", [ false, false, false ] ],
    [ "/x/", [ false, false, false ] ]
  ].forEach(([ code, expected ]) => {
    const parsed = new ParsedCode(code)
    const input = new NativeEvaluationInput(parsed.sourceCode.ast.body.at(-1).expression,
      new BindingResolver(parsed.sourceCode))
    assert.deepEqual([ input.isSafe, input.isNullish, input.isString ], expected, code)
  })
})
