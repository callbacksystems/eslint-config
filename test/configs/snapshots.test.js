import { test } from "node:test"
import { matchScopeSnapshot } from "#support/config-scope"
import { matchSnapshot } from "#support"

const PRESETS = [
  { label: "base", subdir: "base", file: "fixture.js" },
  { label: "browser", subdir: "browser", file: "fixture.js" },
  { label: "edge", subdir: "edge", file: "fixture.js" },
  { label: "node", subdir: "node", file: "fixture.js" },
  { label: "rails", subdir: "rails", file: "fixture.js" },
  { label: "stimulus", subdir: "stimulus", file: "fixture.js" },
  { label: "react", subdir: "react", file: "fixture.jsx" },
  { label: "react-native", subdir: "react-native", file: "fixture.jsx" },
  { label: "svelte", subdir: "svelte", file: "Fixture.svelte" },
  { label: "astro", subdir: "astro", file: "fixture.astro" }
]

PRESETS.forEach((preset) => {
  test(`the ${preset.label} preset matches its snapshot`, async () => {
    await matchSnapshot(preset)
  })
})

test("every preset reaches the same file types as before", async () => {
  await matchScopeSnapshot(PRESETS.map((preset) => preset.subdir))
})
