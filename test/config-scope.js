// Which file types a preset actually reaches.
//
// The per-preset snapshots resolve one fixture of the preset's own extension, so
// they record what a `.jsx` file gets from `/react` and nothing about whether
// `/react` also claims `.js`. Widening a `files` selector changes no snapshot
// and no test: that is how React silently grew to cover `.js` and shrank back.
//
// This records the answer directly, and stays small by keeping only the shape:
// the rule namespaces that reach each extension, plus the parser and source type.
// A preset gaining or losing an extension moves a line here.

import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import { ESLint } from "eslint"

const HERE = path.dirname(url.fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = path.join(HERE, "snapshots", "scope.json")
const EXTENSIONS = [ "cjs", "js", "jsx", "mjs", "astro", "svelte" ]

export async function matchScopeSnapshot(subdirs) {
  const actual = `${JSON.stringify(await scopesOf(subdirs), null, 2)}\n`

  await (process.env.UPDATE_SNAPSHOTS
    ? writeFile(SNAPSHOT_PATH, actual)
    : compareToCommitted(actual))
}

async function scopesOf(subdirs) {
  const entries = await Promise.all(subdirs.map(async (subdir) => [ subdir, await scopeOf(subdir) ]))
  return Object.fromEntries(entries)
}

async function scopeOf(subdir) {
  const cwd = path.join(HERE, "fixtures", subdir)
  const eslint = new ESLint({ cwd })
  const entries = await Promise.all(EXTENSIONS.map(async (extension) => [
    extension,
    await reachAt(eslint, path.join(cwd, `probe.${extension}`))
  ]))
  return Object.fromEntries(entries)
}

// An ignored or unmatched path resolves to no config at all, which is itself the
// answer: the preset does not reach that extension.
async function reachAt(eslint, file) {
  const config = await eslint.calculateConfigForFile(file).catch(() => null)
  return config?.rules ? reachedBy(config) : null
}

function reachedBy(config) {
  const languageOptions = config.languageOptions ?? {}
  return {
    parser: parserNameOf(languageOptions.parser),
    sourceType: languageOptions.sourceType ?? null,
    ruleNamespaces: namespacesIn(config.rules)
  }
}

function parserNameOf(parser) {
  return parser ? parser.meta?.name ?? parser.name ?? "unknown" : null
}

function namespacesIn(rules) {
  return [ ...new Set(Object.keys(rules).map(namespaceOf)) ].sort()
}

function namespaceOf(ruleId) {
  return ruleId.includes("/") ? ruleId.slice(0, ruleId.lastIndexOf("/")) : "core"
}

async function compareToCommitted(actual) {
  const expected = await readFile(SNAPSHOT_PATH, "utf8").catch(() => null)
  const hint = "Preset scope drift: a preset now reaches a different set of file types. "
    + "Review the diff and run `npm run test:update-snapshots` if intentional."
  assert.equal(actual, expected, hint)
}
