import assert from "node:assert/strict"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { VirtualModulesResolver } from "#helpers/eslint/virtual_modules_resolver"

const RESOLVED = { found: true, path: null }
const UNRESOLVED = { found: false }

test("Astro modules resolve where the project depends on Astro", async () => {
  const file = await projectWith({ astro: "^7.2.0" })
  const resolver = new VirtualModulesResolver()

  assert.deepEqual(resolver.resolve("astro:content", file), RESOLVED)
  assert.deepEqual(
    resolver.resolve("virtual:astro:image-styles.css", file),
    RESOLVED,
    "Astro provides this virtual module"
  )
  assert.deepEqual(resolver.resolve("astro:db", file), UNRESOLVED, "Astro DB has its own provider")
})

test("a module stays unresolved where its provider is missing", async () => {
  const file = await projectWith({ astro: "^7.2.0" })
  assert.deepEqual(new VirtualModulesResolver().resolve("cloudflare:workers", file), UNRESOLVED)
})

test("wrangler is what makes the Cloudflare scheme resolve", async () => {
  const file = await projectWith({ wrangler: "^4.0.0" })
  const resolver = new VirtualModulesResolver()

  assert.deepEqual(resolver.resolve("cloudflare:workers", file), RESOLVED)
  assert.deepEqual(resolver.resolve("cloudflare:test", file), UNRESOLVED)
})

test("the Cloudflare Vitest plugin provides its test and workers modules", async () => {
  const file = await projectWith({ "@cloudflare/vitest-plugin": "^1.0.0" })
  const resolver = new VirtualModulesResolver()

  assert.deepEqual(resolver.resolve("cloudflare:test", file), RESOLVED)
  assert.deepEqual(resolver.resolve("cloudflare:workers", file), RESOLVED)
  assert.deepEqual(resolver.resolve("cloudflare:tests", file), UNRESOLVED)
})

test("the Astro DB integration only provides its own module", async () => {
  const file = await projectWith({ "@astrojs/db": "^0.18.0" })
  const resolver = new VirtualModulesResolver()

  assert.deepEqual(resolver.resolve("astro:db", file), RESOLVED)
  assert.deepEqual(resolver.resolve("astro:content", file), UNRESOLVED)
  assert.deepEqual(resolver.resolve("astro:bd", file), UNRESOLVED)
})

test("unknown modules are left to the resolvers behind this one", async () => {
  const file = await projectWith({ astro: "^7.2.0" })
  const resolver = new VirtualModulesResolver()

  assert.deepEqual(resolver.resolve("vercel:edge", file), UNRESOLVED, "resolving any scheme would hide a typo")
  assert.deepEqual(resolver.resolve("astro", file), UNRESOLVED, "a package name is not a scheme")
  assert.deepEqual(resolver.resolve("astro:contnet", file), UNRESOLVED, "a misspelled built-in must not resolve")
  assert.deepEqual(resolver.resolve("virtual:astro:image-style.css", file), UNRESOLVED, "virtual modules are exact")
})

test("Vite does not provide arbitrary virtual specifiers by itself", async () => {
  const file = await projectWith({ vite: "^7.0.0" })
  const resolver = new VirtualModulesResolver()

  assert.deepEqual(resolver.resolve("virtual:custom", file), UNRESOLVED)
  assert.deepEqual(resolver.resolve("virtual:astro:image-styles.css", file), UNRESOLVED)
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

test("peer and optional dependencies can provide virtual modules", async () => {
  const peerRoot = await projectWithManifest({ peerDependencies: { astro: "^7.2.0" } })
  const optionalRoot = await projectWithManifest({ optionalDependencies: { wrangler: "^4.0.0" } })

  assert.deepEqual(new VirtualModulesResolver().resolve("astro:content", path.join(peerRoot, "entry.js")), RESOLVED)
  assert.deepEqual(
    new VirtualModulesResolver().resolve("cloudflare:workers", path.join(optionalRoot, "entry.js")),
    RESOLVED
  )
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

test("a malformed manifest cannot crash lint resolution", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "malformed-"))
  await writeFile(path.join(root, "package.json"), "{")

  assert.deepEqual(new VirtualModulesResolver().resolve("astro:content", path.join(root, "worker.js")), UNRESOLVED)
})

async function projectWith(devDependencies, subdir = ".") {
  const root = await projectWithManifest({ devDependencies })

  const directory = path.join(root, subdir)
  await mkdir(directory, { recursive: true })
  return path.join(directory, "entry.js")
}

async function projectWithManifest(manifest) {
  const root = await mkdtemp(path.join(tmpdir(), "project-"))
  const manifestFile = path.join(root, "package.json")
  await writeFile(manifestFile, JSON.stringify(manifest))
  return path.dirname(manifestFile)
}
