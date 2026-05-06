import assert from "node:assert/strict"
import { test } from "node:test"
import { lintFixture } from "#support"

test("a `.cjs` file parses as CommonJS", async () => {
  const { messageCount, fatalErrorCount } = await lintFixture({ subdir: "commonjs", file: "fixture.cjs" })
  assert.equal(fatalErrorCount, 0, "fixture must parse")
  // Read as an ES module instead, the fixture's `require` and `module` would surface as `no-undef`.
  assert.equal(messageCount, 0, "a plain CommonJS module should be clean")
})
