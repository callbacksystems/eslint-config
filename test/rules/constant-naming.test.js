import rule from "#rules/constant-naming"
import { dedent, tester } from "#support"

tester.run("constant-naming", rule, {
  valid: [
    // Already SCREAMING_SNAKE_CASE primitives.
    "const MAX_RETRIES = 5",
    "const GREETING = `hello`",
    "const OFFSET = -1",
    "const MAX = 100",
    "const SENTINEL = null",
    "export const DEFAULT_LEVEL = 3",
    "class C { static MAX_SIZE = 10 }",
    "class C { static #SECRET = \"k\" }",
    // Not a literal primitive: computed, aliased, constructed, object/array, function.
    "const week = atom(\"week\")",
    "const csv = [ a, b ].join(\",\")",
    "const store = new Map()",
    "const total = a + b",
    "const config = { url: 1 }",
    "const list = [ 1, 2, 3 ]",
    "const handler = () => 1",
    // Local consts and destructuring are out of scope.
    "function f() { const max = 5; return max }",
    "const { a, b } = settings",
    "const [ first ] = items"
  ],
  invalid: [
    {
      code: "const maxRetries = 5",
      output: "const MAX_RETRIES = 5",
      errors: [ { messageId: "literalConstantCase", data: { name: "maxRetries", expected: "MAX_RETRIES" } } ]
    },
    // An inner scope already owns the new name: renaming would rebind the read to that inner constant, so it is
    // reported and left alone.
    {
      code: dedent`
        const foo = 1

        function value() {
          const FOO = 2
          return foo + FOO
        }
      `,
      output: null,
      errors: [ { messageId: "literalConstantCase", data: { name: "foo", expected: "FOO" } } ]
    },
    {
      code: "const greeting = `hi`",
      output: "const GREETING = `hi`",
      errors: [ { messageId: "literalConstantCase", data: { name: "greeting", expected: "GREETING" } } ]
    },
    {
      code: "const offset = -1",
      output: "const OFFSET = -1",
      errors: [ { messageId: "literalConstantCase", data: { name: "offset", expected: "OFFSET" } } ]
    },
    {
      code: "const sentinel = null",
      output: "const SENTINEL = null",
      errors: [ { messageId: "literalConstantCase", data: { name: "sentinel", expected: "SENTINEL" } } ]
    },
    {
      // The fixer renames every in-file reference too.
      code: dedent`
        const maxRetries = 5
        attempt(maxRetries)
      `,
      output: dedent`
        const MAX_RETRIES = 5
        attempt(MAX_RETRIES)
      `,
      errors: [ { messageId: "literalConstantCase", data: { name: "maxRetries", expected: "MAX_RETRIES" } } ]
    },
    {
      // Exported const: report-only, a single-file rename can't follow importers.
      code: "export const defaultLevel = 3",
      output: null,
      errors: [ { messageId: "literalConstantCase", data: { name: "defaultLevel", expected: "DEFAULT_LEVEL" } } ]
    },
    {
      // Re-exported via `export { ... }`: report-only.
      code: dedent`
        const maxRetries = 5
        export { maxRetries }
      `,
      output: null,
      errors: [ { messageId: "literalConstantCase", data: { name: "maxRetries", expected: "MAX_RETRIES" } } ]
    },
    {
      // Static literal field: report-only (reached as Class.X elsewhere).
      code: "class C { static maxSize = 10 }",
      output: null,
      errors: [ { messageId: "literalConstantCase", data: { name: "maxSize", expected: "MAX_SIZE" } } ]
    }
  ]
})
