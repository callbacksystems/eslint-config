import rule from "#rules/no-padded-braces"
import { dedent, tester } from "#test/support"

tester.run("no-padded-braces", rule, {
  valid: [
    // Single-line braces.
    "import { a, b } from 'mod'",
    "const obj = { a: 1, b: 2 }",
    "const { a, b } = { a: 1, b: 2 }",
    "export { a, b } from 'mod'",
    // Multi-line without padding.
    dedent`
      import {
        a,
        b
      } from 'mod'
    `,
    dedent`
      const obj = {
        a: 1,
        b: 2
      }
    `,
    // Blank lines BETWEEN entries are fine.
    dedent`
      const obj = {
        a: 1,

        b: 2
      }
    `,
    dedent`
      import {
        a,

        b
      } from 'mod'
    `,
    // Empty braces.
    "const obj = {}",
    // Comment right after `{` without padding is OK.
    dedent`
      const obj = {
        // header
        a: 1
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        import {

          foo
        } from 'mod'
      `,
      output: dedent`
        import {
          foo
        } from 'mod'
      `,
      errors: [ { messageId: "afterOpen" } ]
    },
    {
      code: dedent`
        import {
          foo

        } from 'mod'
      `,
      output: dedent`
        import {
          foo
        } from 'mod'
      `,
      errors: [ { messageId: "beforeClose" } ]
    },
    {
      code: dedent`
        const obj = {

          a: 1

        }
      `,
      output: dedent`
        const obj = {
          a: 1
        }
      `,
      errors: [ { messageId: "afterOpen" }, { messageId: "beforeClose" } ]
    },
    {
      code: dedent`
        const { a,
          b

        } = { a: 1, b: 2 }
      `,
      output: dedent`
        const { a,
          b
        } = { a: 1, b: 2 }
      `,
      errors: [ { messageId: "beforeClose" } ]
    },
    {
      code: dedent`
        export {

          foo
        } from 'mod'
      `,
      output: dedent`
        export {
          foo
        } from 'mod'
      `,
      errors: [ { messageId: "afterOpen" } ]
    }
  ]
})
