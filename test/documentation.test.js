import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { matchRulesDocument, rulesMisfiledByNamespace } from "#test/rules-document"

describe("rule reference", () => {
  it("matches the generated document", async () => {
    await matchRulesDocument()
  })

  it("keeps every rule in the preset its namespace names", () => {
    const misfiled = rulesMisfiledByNamespace()
    const hint = "These rules are not in the preset their namespace names, which the reference states as a rule: "
      + `${misfiled.join(", ")}. Move them, or reword docs/README.md.`
    assert.deepEqual(misfiled, [], hint)
  })
})
