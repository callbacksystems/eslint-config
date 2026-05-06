import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { lintFixture } from "#test/support"

describe("astro preset (smoke)", () => {
  it("lints a real .astro fixture without crashing", async () => {
    const { messageCount, fatalErrorCount } = await lintFixture({ subdir: "astro", file: "fixture.astro" })
    assert.equal(fatalErrorCount, 0, "fixture must parse")
    assert.equal(messageCount, 0, "fixture is clean and should produce no violations")
  })
})
