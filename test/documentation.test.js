import assert from "node:assert/strict"
import { test } from "node:test"
import { RulesDocument } from "#scripts/rules-document"

const document = new RulesDocument()

test("the rule reference matches the generated document", async () => {
  assert.equal(document.text, await document.committed, "docs/rules.md is out of date. Run `npm run docs`.")
})

test("every rule is in the preset its namespace names", () => {
  const misfiled = document.misfiledByNamespace
  const hint = "These rules are not in the preset their namespace names, which the reference states as a rule: "
    + `${misfiled.join(", ")}. Move them, or reword docs/rules.md.`
  assert.deepEqual(misfiled, [], hint)
})
