import rule from "#rules/compact-guard-clause"
import { dedent, tester } from "#test/helpers"

tester.run("compact-guard-clause", rule, {
  valid: [
    "function f(x) { if (x) return }",
    "function f(x) { if (x) return null }",
    dedent`
      function f(x) {
        if (x) {
          doSomething()
          return
        }
      }
    `,
    dedent`
      function f(x) {
        if (x) {
          // explanatory comment
          return
        }
      }
    `,
    dedent`
      function f(x) {
        if (x) {
          return
        } else {
          other()
        }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        function f() {
          if (x) {
            return
          }
        }
      `,
      output: dedent`
        function f() {
          if (x) return
        }
      `,
      errors: [ { messageId: "compactGuardClause" } ]
    },
    {
      code: dedent`
        function f() {
          if (x) {
            throw new Error("oops")
          }
        }
      `,
      output: dedent`
        function f() {
          if (x) throw new Error("oops")
        }
      `,
      errors: [ { messageId: "compactGuardClause" } ]
    }
  ]
})
