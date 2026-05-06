import assert from "node:assert/strict"
import { test } from "node:test"
import { globsIn } from "#helpers/eslint/globs"

test("formats individual and combined glob entries", () => {
  assert.equal(globsIn([ "src/**/*.js", [ "test/**/*.js", "!test/fixtures/**" ] ]),
    "src/**/*.js, test/**/*.js + !test/fixtures/**")
})
