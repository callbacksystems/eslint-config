import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { lintFixture } from "#test/helpers"

// Smoke test: snapshots already cover *what* rules are enabled. This proves the
// pipeline runs end-to-end on real code without crashing.
describe("rails preset (smoke)", () => {
  it("lints a real fixture without crashing and produces violations", async () => {
    const { messageCount } = await lintFixture({ subdir: "rails", file: "fixture.js" })
    assert.ok(messageCount > 0, "fixture is engineered to produce violations")
  })
})
