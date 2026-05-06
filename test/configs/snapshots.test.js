import { describe, it } from "node:test"
import { matchScopeSnapshot } from "#test/config-scope"
import { matchSnapshot } from "#test/support"

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

describe("preset snapshots", () => {
  PRESETS.forEach((preset) => {
    it(`${preset.label} matches snapshot`, async () => {
      await matchSnapshot(preset)
    })
  })

  // What the per-preset snapshots above cannot see: they resolve one fixture of
  // the preset's own extension, so a `files` selector widening to another
  // extension moves none of them.
  it("every preset reaches the same file types as before", async () => {
    await matchScopeSnapshot(PRESETS.map((preset) => preset.subdir))
  })
})
