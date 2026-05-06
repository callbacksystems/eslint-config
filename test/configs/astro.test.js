import assert from "node:assert/strict"
import { test } from "node:test"
import { lintFixture } from "#support"

test("the astro preset lints a real .astro fixture without crashing", async () => {
  const { messageCount, fatalErrorCount } = await lintFixture({ subdir: "astro", file: "fixture.astro" })
  assert.equal(fatalErrorCount, 0, "fixture must parse")
  assert.equal(messageCount, 0, "fixture is clean and should produce no violations")
})
