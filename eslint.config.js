import base from "#base"
import node from "#node"

export default [
  ...base,
  ...node,
  {
    // ESLint plugin convention: custom rule files use kebab-case (matches the
    // rule ID like `no-typographic-clutter`).
    rules: {
      "unicorn/filename-case": [ "error", { cases: { snakeCase: true, kebabCase: true } } ]
    }
  },
  {
    // RuleTester registers its cases through its own run(), so sonarjs sees no
    // literal it()/test() call and flags the file as empty. Only rule tests use
    // RuleTester; the config tests use real describe/it.
    files: [ "test/rules/**/*.test.js" ],
    rules: { "sonarjs/no-empty-test-file": "off" }
  },
  {
    files: [ "test/fixtures/**" ],
    rules: {
      // Fixture files exist to violate rules; ignore them in our own lint pass.
      "no-restricted-syntax": "off"
    }
  },
  {
    ignores: [ "test/fixtures/**" ]
  }
]
