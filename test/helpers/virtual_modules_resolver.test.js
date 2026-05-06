import assert from "node:assert/strict"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { VirtualModulesResolver } from "#helpers/virtual_modules_resolver"

const RESOLVED = { found: true, path: null }
const UNRESOLVED = { found: false }

test("a scheme resolves where the project depends on the tool serving it", async () => {
  const file = await projectWith({ astro: "^7.2.0" })
  const resolver = new VirtualModulesResolver()

  assert.deepEqual(resolver.resolve("astro:content", file), RESOLVED)
  assert.deepEqual(resolver.resolve("virtual:astro:image-styles.css", file), RESOLVED, "Astro brings Vite along")
})

test("a scheme stays unresolved where the tool is missing", async () => {
  const file = await projectWith({ astro: "^7.2.0" })
  assert.deepEqual(new VirtualModulesResolver().resolve("cloudflare:workers", file), UNRESOLVED)
})

test("wrangler is what makes the Cloudflare scheme resolve", async () => {
  const file = await projectWith({ wrangler: "^4.0.0" })
  assert.deepEqual(new VirtualModulesResolver().resolve("cloudflare:workers", file), RESOLVED)
})

test("an unknown scheme is left to the resolvers behind it", async () => {
  const file = await projectWith({ astro: "^7.2.0" })
  const resolver = new VirtualModulesResolver()

  assert.deepEqual(resolver.resolve("vercel:edge", file), UNRESOLVED, "resolving any scheme would hide a typo")
  assert.deepEqual(resolver.resolve("astro", file), UNRESOLVED, "a package name is not a scheme")
})

test("the lookup climbs from the importing file, not from the working directory", async () => {
  const file = await projectWith({ wrangler: "^4.0.0" }, "src/handlers")
  assert.deepEqual(new VirtualModulesResolver().resolve("cloudflare:workers", file), RESOLVED)
})

test("a runtime dependency counts as much as a development one", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "runtime-"))
  await writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: { astro: "^7.2.0" } }))

  assert.deepEqual(new VirtualModulesResolver().resolve("astro:content", path.join(root, "entry.js")), RESOLVED)
})

test("the search stops at the repository instead of climbing out of it", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "orphan-"))
  await writeFile(path.join(root, ".git"), "")

  assert.deepEqual(new VirtualModulesResolver().resolve("astro:content", path.join(root, "worker.js")), UNRESOLVED)
})

test("a file under no repository at all resolves nothing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "loose-"))
  assert.deepEqual(new VirtualModulesResolver().resolve("astro:content", path.join(root, "worker.js")), UNRESOLVED)
})

async function projectWith(devDependencies, subdir = ".") {
  const root = await mkdtemp(path.join(tmpdir(), "project-"))
  await writeFile(path.join(root, "package.json"), JSON.stringify({ devDependencies }))

  const directory = path.join(root, subdir)
  await mkdir(directory, { recursive: true })
  return path.join(directory, "entry.js")
}
