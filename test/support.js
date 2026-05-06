import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { describe, it } from "node:test"
import url from "node:url"
import { ESLint, RuleTester } from "eslint"

const HERE = path.dirname(url.fileURLToPath(import.meta.url))
const FIXTURES = path.join(HERE, "fixtures")
const SNAPSHOTS = path.join(HERE, "snapshots")

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

export const tester = new RuleTester({ languageOptions: { ecmaVersion: "latest", sourceType: "module" } })

export function dedent(strings, ...values) {
  const lines = String.raw({ raw: strings.raw }, ...values).split("\n")
  if (lines[0] === "") lines.shift()
  if (lines.at(-1)?.trim() === "") lines.pop()

  const indent = minLeadingSpaces(lines)
  return lines.map((line) => line.slice(indent)).join("\n")
}

export function lintFixture({ subdir, file }) {
  return new Fixture(subdir, file).lint()
}

export async function matchSnapshot({ label, subdir, file }) {
  const config = await new Fixture(subdir, file).config()
  const actual = `${JSON.stringify(normalized(config), null, 2)}\n`

  await (process.env.UPDATE_SNAPSHOTS
    ? writeFile(path.join(SNAPSHOTS, `${label}.json`), actual)
    : compareToCommitted(label, actual))
}

function minLeadingSpaces(lines) {
  const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^ */u)[0].length)
  return indents.length > 0 ? Math.min(...indents) : 0
}

class Fixture {
  #subdir
  #file

  constructor(subdir, file) {
    this.#subdir = subdir
    this.#file = file
  }

  async lint() {
    const results = await new ESLint({ cwd: this.#cwd }).lintFiles([ path.join(this.#cwd, this.#file) ])
    return {
      ruleIds: new Set(results.flatMap((result) => result.messages.map((message) => message.ruleId))),
      messageCount: results.reduce((total, result) => total + result.messages.length, 0)
    }
  }

  async config() {
    return new ESLint({ cwd: this.#cwd }).calculateConfigForFile(path.join(this.#cwd, this.#file))
  }

  get #cwd() {
    return path.join(FIXTURES, this.#subdir)
  }
}

function normalized(config) {
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

function sortObject(object) {
  return Object.fromEntries(Object.keys(object).sort().map((key) => [ key, object[key] ]))
}

async function compareToCommitted(label, actual) {
  const expected = await readSnapshot(label)
  const missingHint = `Missing snapshot for "${label}". Run \`npm run test:update-snapshots\` to create it.`
  assert.ok(expected !== null, missingHint)

  const driftHint = `Snapshot drift for "${label}". `
    + "Review the diff and run `npm run test:update-snapshots` if intentional."
  assert.equal(actual, expected, driftHint)
}

async function readSnapshot(label) {
  try {
    return await readFile(path.join(SNAPSHOTS, `${label}.json`), "utf8")
  } catch (error) {
    if (error.code === "ENOENT") return null
    throw error
  }
}
