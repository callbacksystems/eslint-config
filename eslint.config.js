import base from "#base"
import node from "#node"

export default [
  ...base,
  ...node,
  {
    // ESLint plugin convention: custom rule files use kebab-case (matches the rule ID like `no-typographic-clutter`).
    rules: { "unicorn/filename-case": [ "error", { cases: { snakeCase: true, kebabCase: true } } ] }
  },
  {
    // RuleTester registers its cases through its own run(), so sonarjs sees no literal test() call and flags the file
    // as empty.
    files: [ "test/rules/**/*.test.js" ],
    rules: { "sonarjs/no-empty-test-file": "off" }
  },
  { ignores: [ "test/fixtures/**" ] }
]
