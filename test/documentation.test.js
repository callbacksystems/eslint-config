import assert from "node:assert/strict"
import { test } from "node:test"
import { RulesDocument } from "#scripts/rules_document"
import { problemsIn, readmeExamples } from "#support"

const document = new RulesDocument()

test("the rule reference matches the generated document", async () => {
  assert.equal(document.text, await document.committed, "docs/rules.md is out of date. Run `npm run docs`.")
})

test("every js example in the README passes the config it documents", async () => {
  const examples = await readmeExamples()
  assert.ok(examples.length > 0, "no `js` blocks found in the README")

  const reports = await Promise.all(examples.map(async (example, index) => ({
    index: index + 1,
    problems: await problemsIn(example)
  })))
  const failing = reports.filter((report) => report.problems.length > 0)
  assert.deepEqual(failing, [], `README examples break the config: ${JSON.stringify(failing, null, 2)}`)
})

test("every rule is in the preset its namespace names", () => {
  const misfiled = document.misfiledByNamespace
  const hint = "These rules are not in the preset their namespace names, which the reference states as a rule: "
    + `${misfiled.join(", ")}. Move them, or reword docs/rules.md.`
  assert.deepEqual(misfiled, [], hint)
})
