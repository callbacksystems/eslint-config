import assert from "node:assert/strict"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

// The preset reads the project once, as it loads, so it has to load from inside an importmap project.
const root = await mkdtemp(path.join(tmpdir(), "importmap-"))
await writeFile(path.join(root, "Gemfile"), "source \"https://rubygems.org\"\n")
await mkdir(path.join(root, "config"))
await writeFile(path.join(root, "config", "importmap.rb"), "pin \"application\"\n")
process.chdir(root)
const { default: rails } = await import("#rails")

test("the rails preset turns off no-unresolved under importmap", () => {
  const { rules } = rails.find((block) => block.name === "@callbacksystems/rails")
  assert.equal(rules["import-x/no-unresolved"], "off", "the map resolves bare imports, not ESLint")
})
