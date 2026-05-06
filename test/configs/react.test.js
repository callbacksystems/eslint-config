import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { lintFixture } from "#test/support"

describe("react preset (smoke)", () => {
  it("lints a real fixture without crashing and produces violations", async () => {
    const { messageCount, fatalErrorCount } = await lintFixture({ subdir: "react", file: "fixture.jsx" })
    assert.equal(fatalErrorCount, 0, "fixture must parse")
    assert.ok(messageCount > 0, "fixture is engineered to produce violations")
  })

  // Components go in `.jsx`, and this is the mechanism that enforces it. If JSX
  // ever starts parsing in `.js`, a component written there would lint clean
  // with no React or hooks rule looking at it, which is the failure this
  // deliberate parse error prevents.
  it("refuses JSX in a `.js` file, so a component cannot hide there", async () => {
    const { fatalErrorCount } = await lintFixture({ subdir: "react", file: "component.js" })
    assert.ok(fatalErrorCount > 0, "JSX in `.js` must fail to parse rather than go unlinted")
  })
})
