import { describe, it } from "node:test"
import { matchSnapshot } from "#test/helpers"

const PRESETS = [
  { label: "base", subdir: "base", file: "fixture.js" },
  { label: "browser", subdir: "browser", file: "fixture.js" },
  { label: "edge", subdir: "edge", file: "fixture.js" },
  { label: "node", subdir: "node", file: "fixture.js" },
  { label: "rails", subdir: "rails", file: "fixture.js" },
  { label: "typescript", subdir: "typescript", file: "fixture.ts" },
  { label: "react", subdir: "react", file: "fixture.tsx" },
  { label: "react-native", subdir: "react-native", file: "fixture.tsx" }
]

describe("preset snapshots", () => {
  for (const preset of PRESETS) {
    it(`${preset.label} matches snapshot`, async () => {
      await matchSnapshot(preset)
    })
  }
})
