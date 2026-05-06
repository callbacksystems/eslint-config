import node from "#node"

export default [
  ...node,
  {
    // ESLint plugin convention: custom rule files use kebab-case (matches the
    // rule ID like `no-em-dash`).
    rules: {
      "unicorn/filename-case": [ "error", { cases: { snakeCase: true, kebabCase: true } } ]
    }
  },
  {
    files: [ "test/**/*.test.js" ],
    rules: {
      // RuleTester wraps describe/it internally; the file looks empty to the linter.
      "sonarjs/no-empty-test-file": "off",
      // Test fixtures intentionally contain the patterns the rules detect.
      "callbacksystems/no-em-dash": "off",
      // `describe` callbacks contain N nested `it` blocks; the limits assume a
      // single linear function body, not a suite container.
      "max-lines-per-function": "off",
      "max-statements": "off"
    }
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
