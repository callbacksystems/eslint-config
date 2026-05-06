import assert from "node:assert/strict"
import { test } from "node:test"
import { lintFixture } from "#support"

// The fixture climbs to this repository's own manifest, where `astro` is the devDependency the resolver reads.
test("a virtual module resolves through the whole pipeline", async () => {
  const { ruleIds } = await lintFixture({ subdir: "virtual_modules", file: "resolved.js" })
  assert.ok(!ruleIds.has("import-x/no-unresolved"), "`astro:` and `virtual:` come from a dependency of this project")
})

test("a scheme sorts with the builtins rather than the packages", async () => {
  const { ruleIds } = await lintFixture({ subdir: "virtual_modules", file: "misplaced.js" })
  assert.ok(ruleIds.has("import-x/order"), "`astro:content` must lead `eslint`")
})
