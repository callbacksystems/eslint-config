import assert from "node:assert/strict"
import { test } from "node:test"
import { lintFixture } from "#support"

test("the rails preset lints a real fixture without crashing and produces violations", async () => {
  const { messageCount, fatalErrorCount } = await lintFixture({ subdir: "rails", file: "fixture.js" })
  assert.equal(fatalErrorCount, 0, "fixture must parse")
  assert.ok(messageCount > 0, "fixture is engineered to produce violations")
})
