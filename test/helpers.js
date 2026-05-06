import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { describe, it } from "node:test"
import url from "node:url"
import { ESLint, RuleTester } from "eslint"

const HERE = path.dirname(url.fileURLToPath(import.meta.url))
const FIXTURES = path.join(HERE, "fixtures")
const SNAPSHOTS = path.join(HERE, "snapshots")

// RuleTester helpers

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

export const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  }
})

const minLeadingSpaces = (lines) => {
  const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^ */u)[0].length)
  return indents.length > 0 ? Math.min(...indents) : 0
}

export const dedent = (strings, ...values) => {
  const raw = String.raw({ raw: strings.raw }, ...values)
  const lines = raw.split("\n")
  if (lines[0] === "") lines.shift()
  if (lines.at(-1)?.trim() === "") lines.pop()

  const indent = minLeadingSpaces(lines)
  return lines.map((line) => line.slice(indent)).join("\n")
}

// Fixture lint helpers

export const lintFixture = async ({ subdir, file }) => {
  const cwd = path.join(FIXTURES, subdir)
  const eslint = new ESLint({ cwd })
  const results = await eslint.lintFiles([ path.join(cwd, file) ])
  return {
    ruleIds: new Set(results.flatMap((result) => result.messages.map((message) => message.ruleId))),
    messageCount: results.reduce((total, result) => total + result.messages.length, 0)
  }
}

export const assertFires = (ruleIds, ruleId) =>
  assert.ok(ruleIds.has(ruleId), `expected rule \`${ruleId}\` to fire but it did not`)

// Snapshot helpers

const sortObject = (object) =>
  Object.fromEntries(Object.keys(object).sort().map((key) => [ key, object[key] ]))

const normalize = (config) => {
  const languageOptions = config.languageOptions ?? {}
  return {
    plugins: Object.keys(config.plugins ?? {}).sort(),
    languageOptions: {
      ecmaVersion: languageOptions.ecmaVersion ?? null,
      sourceType: languageOptions.sourceType ?? null,
      globals: sortObject(languageOptions.globals ?? {})
    },
    rules: sortObject(config.rules ?? {})
  }
}

const computeSnapshot = async ({ subdir, file }) => {
  const cwd = path.join(FIXTURES, subdir)
  const eslint = new ESLint({ cwd })
  const config = await eslint.calculateConfigForFile(path.join(cwd, file))
  return `${JSON.stringify(normalize(config), null, 2)}\n`
}

const readSnapshot = async (label) => {
  try {
    return await readFile(path.join(SNAPSHOTS, `${label}.json`), "utf8")
  } catch (error) {
    if (error.code === "ENOENT") return null
    throw error
  }
}

const compareToCommitted = async (label, actual) => {
  const expected = await readSnapshot(label)
  const missingHint = `Missing snapshot for "${label}". Run \`npm run test:update-snapshots\` to create it.`
  assert.ok(expected !== null, missingHint)

  const driftHint = `Snapshot drift for "${label}". `
    + "Review the diff and run `npm run test:update-snapshots` if intentional."
  assert.equal(actual, expected, driftHint)
}

export const matchSnapshot = async ({ label, subdir, file }) => {
  const actual = await computeSnapshot({ subdir, file })

  await (process.env.UPDATE_SNAPSHOTS
    ? writeFile(path.join(SNAPSHOTS, `${label}.json`), actual)
    : compareToCommitted(label, actual))
}
