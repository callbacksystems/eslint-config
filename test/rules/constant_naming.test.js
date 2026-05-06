import rule from "#rules/constant_naming"
import { dedent, tester } from "#support"

// Interpolated because `no-template-curly-in-string` would flag a literal `${` in this file.
const SUBSTITUTION = "${"

tester.run("constant-naming", rule, {
  valid: [
    "const MAX_RETRIES = 5",
    "const GREETING = `hello`",
    `const GREETING = \`hello ${SUBSTITUTION}1}\``,
    "const OFFSET = -1",
    "const WORD_PATTERN = /word/giu",
    "const MAX = 100",
    "const SENTINEL = null",
    "export const DEFAULT_LEVEL = 3",
    "const week = atom(\"week\")",
    `const greeting = \`hello ${SUBSTITUTION}name}\``,
    "const csv = [ a, b ].join(\",\")",
    "const store = new Map()",
    "const total = a + b",
    "const invalid = +1n",
    "const coerced = +[]",
    "const config = { url: 1 }",
    "const list = [ 1, 2, 3 ]",
    "const handler = () => 1",
    "function f() { const max = 5; return max }",
    "const { a, b } = settings",
    "const [ first ] = items",
    // A static field is framework config or state, not a constant.
    "class C { static component = \"action-bar\" }",
    "class C { static maxSize = 10 }"
  ],
  invalid: [
    {
      code: "const maxRetries = 5",
      output: "const MAX_RETRIES = 5",
      errors: [ { messageId: "literalConstantCase", data: { name: "maxRetries", expected: "MAX_RETRIES" } } ]
    },
    // Renaming would rebind the read to the inner `FOO`, so it is reported and left alone.
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
      code: "const wordPattern = /word/giu",
      output: "const WORD_PATTERN = /word/giu",
      errors: [ { messageId: "literalConstantCase", data: { name: "wordPattern", expected: "WORD_PATTERN" } } ]
    },
    {
      code: "const sentinel = null",
      output: "const SENTINEL = null",
      errors: [ { messageId: "literalConstantCase", data: { name: "sentinel", expected: "SENTINEL" } } ]
    },
    {
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
      code: dedent`
        const maxRetries = 5
        attempt({ maxRetries })
      `,
      output: dedent`
        const MAX_RETRIES = 5
        attempt({ maxRetries: MAX_RETRIES })
      `,
      errors: [ { messageId: "literalConstantCase", data: { name: "maxRetries", expected: "MAX_RETRIES" } } ]
    },
    {
      // A single-file rename cannot follow importers, so an export is report-only.
      code: "export const defaultLevel = 3",
      output: null,
      errors: [ { messageId: "literalConstantCase", data: { name: "defaultLevel", expected: "DEFAULT_LEVEL" } } ]
    },
    {
      code: dedent`
        const maxRetries = 5
        export { maxRetries }
      `,
      output: null,
      errors: [ { messageId: "literalConstantCase", data: { name: "maxRetries", expected: "MAX_RETRIES" } } ]
    },
    // Unconventional and Unicode identifiers remain report-only: sanitizing them is not a safe automatic rename.
    {
      code: "const _value = 1",
      output: null,
      errors: [ { messageId: "literalConstantCase", data: { name: "_value", expected: "VALUE" } } ]
    },
    {
      code: "const café = 1",
      output: null,
      errors: [ { messageId: "literalConstantCase", data: { name: "café", expected: "CAF" } } ]
    },
    {
      code: "const value = 1; eval(\"value\")",
      output: null,
      errors: [ { messageId: "literalConstantCase", data: { name: "value", expected: "VALUE" } } ]
    },
    // Two independent fixes must not converge on one duplicate binding.
    {
      code: "const fooBar = 1\nconst foo_bar = 2",
      output: null,
      errors: [
        { messageId: "literalConstantCase", data: { name: "fooBar", expected: "FOO_BAR" } },
        { messageId: "literalConstantCase", data: { name: "foo_bar", expected: "FOO_BAR" } }
      ]
    },
    // JSDoc references are semantically live under TypeScript/Closure tooling but absent from ESLint's scope graph.
    {
      code: dedent`
        // @ts-check
        const maxRetries = 5
        /** @type {typeof maxRetries} */
        let copy
      `,
      output: null,
      errors: [ { messageId: "literalConstantCase", data: { name: "maxRetries", expected: "MAX_RETRIES" } } ]
    },
    // The destination can already name an ambient/global value in JSDoc even when JavaScript has no such binding.
    {
      code: "/** @type {typeof FOO} */ let copy\nconst foo = 1",
      output: null,
      errors: [ { messageId: "literalConstantCase", data: { name: "foo", expected: "FOO" } } ]
    },
    {
      code: "const value = 1; with (object) { consume(value) }",
      languageOptions: { sourceType: "script" },
      output: null,
      errors: [ { messageId: "literalConstantCase", data: { name: "value", expected: "VALUE" } } ]
    },
    // A classic script's global lexical binding can be read by other scripts that a single-file rename cannot update.
    {
      code: 'const value = 1; result = (0, eval)("value")',
      languageOptions: { sourceType: "script" },
      output: null,
      errors: [ { messageId: "literalConstantCase", data: { name: "value", expected: "VALUE" } } ]
    }
  ]
})
