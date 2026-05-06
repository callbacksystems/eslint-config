import assert from "node:assert/strict"
import { test } from "node:test"
import { failuresIn, ruleSuites } from "#support/fixer-audit"

const suites = await ruleSuites()

test("no fixable rule drops a comment or breaks the syntax", () => {
  const failures = failuresIn(suites)
  assert.deepEqual(failures, [], failures.join("\n\n"))
})
