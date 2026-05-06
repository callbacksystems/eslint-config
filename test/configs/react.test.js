import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { lintFixture } from "#test/support"

describe("react preset (smoke)", () => {
  it("lints a real fixture without crashing and produces violations", async () => {
    const { messageCount } = await lintFixture({ subdir: "react", file: "fixture.jsx" })
    assert.ok(messageCount > 0, "fixture is engineered to produce violations")
  })
})
