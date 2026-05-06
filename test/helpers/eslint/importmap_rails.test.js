import assert from "node:assert/strict"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { usesImportmapRails } from "#helpers/eslint/importmap_rails"

const GEMFILE = "source \"https://rubygems.org\"\n"
const IMPORTMAP = "pin \"application\"\n"

test("usesImportmapRails finds the map from a subdirectory of the project", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "rails-"))
  await writeFile(path.join(root, "Gemfile"), GEMFILE)
  await mkdir(path.join(root, "config"), { recursive: true })
  await writeFile(path.join(root, "config", "importmap.rb"), IMPORTMAP)

  const deep = path.join(root, "app", "javascript", "controllers")
  await mkdir(deep, { recursive: true })
  assert.ok(usesImportmapRails(deep), "running from a subdirectory must still find the map")
})

test("usesImportmapRails is false for a project that bundles instead", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "bundled-"))
  await writeFile(path.join(root, "Gemfile"), GEMFILE)

  assert.ok(!usesImportmapRails(root), "no map means `no-unresolved` has something to check")
})

test("usesImportmapRails stops at the Rails root", async () => {
  const outer = await mkdtemp(path.join(tmpdir(), "outer-"))
  await mkdir(path.join(outer, "config"), { recursive: true })
  await writeFile(path.join(outer, "config", "importmap.rb"), IMPORTMAP)

  const root = path.join(outer, "nested")
  await mkdir(root, { recursive: true })
  await writeFile(path.join(root, "Gemfile"), GEMFILE)
  assert.ok(!usesImportmapRails(root), "a map above the project must not count as this project's")
})

test("usesImportmapRails stops at the repository root", async () => {
  const outer = await mkdtemp(path.join(tmpdir(), "outer-"))
  await writeFile(path.join(outer, "Gemfile"), GEMFILE)
  await mkdir(path.join(outer, "config"), { recursive: true })
  await writeFile(path.join(outer, "config", "importmap.rb"), IMPORTMAP)

  const root = path.join(outer, "bundled")
  await mkdir(path.join(root, ".git"), { recursive: true })
  assert.ok(!usesImportmapRails(root), "a repository of its own must not inherit the map above it")
})

test("usesImportmapRails is false outside any project", async () => {
  const stray = await mkdtemp(path.join(tmpdir(), "stray-"))
  assert.ok(!usesImportmapRails(stray), "the search must give up at the filesystem root")
})
