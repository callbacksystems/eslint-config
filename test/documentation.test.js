import assert from "node:assert/strict"
import { access, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { RulesDocument } from "#scripts/rules_document"
import { ruleSourcePathOf } from "#helpers/eslint/rule_source"
import plugin from "#rules"
import { problemsIn, readmeExamples } from "#support"

const document = new RulesDocument()
const PROJECT_PATH = path.resolve(import.meta.dirname, "..")
const SOURCE_URL = "https://github.com/callbacksystems/eslint-config/blob/main"

test("the rule reference matches the generated document", async () => {
  assert.equal(document.text, await document.committed, "docs/rules.md is out of date. Run `npm run docs`.")
})

test("write puts the generated document at the path", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "docs-"))
  const fresh = new RulesDocument(path.join(folder, "rules.md"))
  assert.equal(await fresh.committed, null, "nothing is committed before the first write")

  await fresh.write()
  assert.equal(await fresh.committed, fresh.text)
})

test("descriptions escape Markdown table separators", () => {
  assert.match(document.text, /`a\(\) \\\|\\\| b\(\) \\\|\\\| c\(\)`/u)
})

test("every rule documentation URL points at its source", async () => {
  await Promise.all(Object.entries(plugin.rules).map(async ([ id, rule ]) => {
    const sourcePath = ruleSourcePathOf(id)
    assert.equal(rule.meta.docs.url, `${SOURCE_URL}/${sourcePath}`)
    await access(path.join(PROJECT_PATH, sourcePath))
  }))
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
