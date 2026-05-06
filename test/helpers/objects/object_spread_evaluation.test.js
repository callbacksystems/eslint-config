import assert from "node:assert/strict"
import { test } from "node:test"
import { ObjectSpreadEvaluation } from "#helpers/objects/object_spread_evaluation"
import { ParsedCode } from "#support"

test("copying own properties distinguishes getters from inert sources", () => {
  [
    [ "({ key: value })", true ],
    [ "({ get key() { return value } })", false ],
    [ "({ set key(value) {} })", true ],
    [ "({ ...source })", true ],
    [ "[]", true ],
    [ "/x/", true ],
    [ "null", true ],
    [ "'text'", true ],
    [ "`text`", true ],
    [ "void value", true ],
    [ "source", false ]
  ].forEach(([ expression, expected ]) => {
    const parsed = new ParsedCode(expression)
    assert.equal(new ObjectSpreadEvaluation(parsed.sourceCode.ast.body[0].expression).isSideEffectFree,
      expected, expression)
  })
  assert.equal(new ObjectSpreadEvaluation(null).isSideEffectFree, false)
})
