import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { failuresIn, ruleSuites, unaudited } from "#test/fixer-audit"

const suites = await ruleSuites()

describe("fixer safety", () => {
  it("no fixable rule drops a comment or breaks the syntax", () => {
    const failures = failuresIn(suites)
    assert.deepEqual(failures, [], failures.join("\n\n"))
  })

  it("every fixable rule has a shape to probe", () => {
    assert.deepEqual(unaudited(suites), [], "add a case to the rule's test file")
  })
})
