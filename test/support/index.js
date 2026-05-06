import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { test } from "node:test"
import url from "node:url"
import { ESLint, RuleTester } from "eslint"
import { alphabetically } from "#helpers/sorting"

const TEST = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..")
const FIXTURES = path.join(TEST, "fixtures")
const SNAPSHOTS = path.join(TEST, "snapshots")

RuleTester.describe = (name, group) => group()
RuleTester.it = test
RuleTester.itOnly = test.only

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

  // A parse error is also a message, so a smoke test counting messages alone passes on a fixture that never parsed.
  async lint() {
    const results = await new ESLint({ cwd: this.#cwd }).lintFiles([ path.join(this.#cwd, this.#file) ])
    const messages = results.flatMap((result) => result.messages)
    return {
      ruleIds: new Set(messages.map((message) => message.ruleId)),
      messageCount: messages.length,
      fatalErrorCount: messages.filter((message) => message.fatal).length
    }
  }

  async config() {
    return new ESLint({ cwd: this.#cwd }).calculateConfigForFile(path.join(this.#cwd, this.#file))
  }

  get #cwd() {
    return path.join(FIXTURES, this.#subdir)
  }
}

// A preset that lost its parser or its `settings.react` would still list every expected rule, so rules are not enough.
function normalized(config) {
  return {
    plugins: Object.keys(config.plugins ?? {}).sort(alphabetically),
    languageOptions: normalizedLanguage(config.languageOptions ?? {}),
    processor: nameOf(config.processor),
    linterOptions: sortObject(config.linterOptions ?? {}),
    settings: sortObject(config.settings ?? {}),
    rules: sortObject(config.rules ?? {})
  }
}

function normalizedLanguage(languageOptions) {
  return {
    ecmaVersion: languageOptions.ecmaVersion ?? null,
    sourceType: languageOptions.sourceType ?? null,
    parser: nameOf(languageOptions.parser),
    parserOptions: sortObject(languageOptions.parserOptions ?? {}),
    globals: sortObject(languageOptions.globals ?? {})
  }
}

// The version is left out on purpose, since a patch bump would break every snapshot for nothing.
function nameOf(module) {
  return module ? module.meta?.name ?? module.name ?? "unknown" : null
}

function sortObject(object) {
  return Object.fromEntries(Object.keys(object).sort(alphabetically).map((key) => [ key, object[key] ]))
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
