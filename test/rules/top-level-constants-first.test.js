import rule from "#rules/top-level-constants-first"
import { dedent, tester } from "#test/support"

tester.run("top-level-constants-first", rule, {
  valid: [
    // Consts already lead, then the functions that use them.
    dedent`
      const A = 1
      const B = 2

      function run() {
        return A + B
      }
    `,
    // An exported const leads, then a class.
    dedent`
      export const MAX = 10

      class Widget {}
    `,
    // Imports stay above the consts they precede.
    dedent`
      import x from "y"

      const A = x

      function run() {
        return A
      }
    `,
    // No consts: nothing to group.
    dedent`
      function high() {
        return low()
      }

      function low() {
        return 1
      }
    `,
    // A const after an effectful statement but before any function stays put:
    // it already leads the functions, and moving it would reorder side effects.
    dedent`
      setup()

      const A = 1

      function run() {
        return A
      }
    `
  ],
  invalid: [
    {
      // A const wedged between functions rises above both.
      code: dedent`
        function low() {
          return 1
        }

        const VERSION = 1

        function high() {
          return low()
        }
      `,
      output: dedent`
        const VERSION = 1

        function low() {
          return 1
        }

        function high() {
          return low()
        }
      `,
      errors: [ { messageId: "constAfterCode", data: { name: "VERSION" } } ]
    },
    {
      // Two consts keep their relative order (not alphabetized).
      code: dedent`
        function f() {
          return 1
        }

        const Z = 1

        const A = 2
      `,
      output: dedent`
        const Z = 1

        const A = 2

        function f() {
          return 1
        }
      `,
      errors: [ { messageId: "constAfterCode", data: { name: "Z" } } ]
    },
    {
      // An exported const after a class rises, keeping `export`.
      code: dedent`
        class Widget {}

        export const MAX = 10
      `,
      output: dedent`
        export const MAX = 10

        class Widget {}
      `,
      errors: [ { messageId: "constAfterCode", data: { name: "MAX" } } ]
    },
    {
      // A const's own-line leading comment travels with it.
      code: dedent`
        function helper() {
          return 1
        }

        // The cap.
        const LIMIT = 5
      `,
      output: dedent`
        // The cap.
        const LIMIT = 5

        function helper() {
          return 1
        }
      `,
      errors: [ { messageId: "constAfterCode", data: { name: "LIMIT" } } ]
    },
    {
      // Flagged but report-only: an effectful statement sits in the run, so
      // reordering past it could change behavior.
      code: dedent`
        function f() {
          return 1
        }

        init()

        const A = 1
      `,
      output: null,
      errors: [ { messageId: "constAfterCode", data: { name: "A" } } ]
    }
  ]
})
