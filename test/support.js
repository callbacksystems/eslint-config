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

  // `fatalErrorCount` is reported separately because a parse error is also a
  // message: a smoke test asserting "more than zero messages" passes on a
  // fixture the preset could not even parse.
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

// Parser, processor and settings are the whole point of the stack presets: an
// Astro or Svelte config that lost its parser, or a React one that lost its
// `settings.react`, would still list every expected rule. Snapshotting the rules
// alone cannot see that break.
function normalized(config) {
  return {
    plugins: Object.keys(config.plugins ?? {}).sort(),
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

// A parser or processor is a live module, so only its identity can be recorded.
// The version is left out on purpose: pinning it here would break every snapshot
// on an unrelated patch bump and teach the reader to regenerate without looking.
function nameOf(module) {
  return module ? module.meta?.name ?? module.name ?? "unknown" : null
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
