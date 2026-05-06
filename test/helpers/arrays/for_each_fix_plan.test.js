import assert from "node:assert/strict"
import { test } from "node:test"
import { ForEachFixPlan } from "#helpers/arrays/for_each_fix_plan"

test("leaves an unexpected overlapping edit plan fixless", () => {
  const node = { range: [ 0, 6 ] }
  const loop = {
    node,
    parent: null,
    isConvertible: true,
    edits: [ { range: [ 1, 4 ], text: "first", depth: 0 }, { range: [ 3, 5 ], text: "second", depth: 0 } ],
    canFixWith: () => true,
    problemWith: (fix) => ({ fix })
  }
  const sourceCode = { text: "source", getAllComments: () => [] }

  assert.equal(new ForEachFixPlan([ loop ], sourceCode).problems[0].fix, null)
})
