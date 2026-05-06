import assert from "node:assert/strict"
import { test } from "node:test"
import { lintFixture } from "#support"

test("the react preset lints a real fixture without crashing and produces violations", async () => {
  const { messageCount, fatalErrorCount } = await lintFixture({ subdir: "react", file: "fixture.jsx" })
  assert.equal(fatalErrorCount, 0, "fixture must parse")
  assert.ok(messageCount > 0, "fixture is engineered to produce violations")
})

test("the react preset refuses JSX in a `.js` file, so a component cannot hide there", async () => {
  const { fatalErrorCount } = await lintFixture({ subdir: "react", file: "component.js" })
  assert.ok(fatalErrorCount > 0, "JSX in `.js` must fail to parse rather than go unlinted")
})
