import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { lintFixture } from "#test/support"

describe("commonjs (smoke)", () => {
  it("parses a `.cjs` file as CommonJS", async () => {
    const { messageCount, fatalErrorCount } = await lintFixture({ subdir: "commonjs", file: "fixture.cjs" })
    assert.equal(fatalErrorCount, 0, "fixture must parse")
    // `require` and `module` are only defined when the file is read as a script,
    // so parsing `.cjs` as an ES module would surface them as `no-undef`.
    assert.equal(messageCount, 0, "a plain CommonJS module should be clean")
  })
})
