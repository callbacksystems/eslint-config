import rule from "#rules/compact-guard-clause"
import { dedent, tester } from "#test/support"

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
    `,
    // A lower `maxLength` leaves guards that would collapse too wide alone.
    {
      code: dedent`
        function f() {
          if (condition) {
            return computeSomethingFairlyLong()
          }
        }
      `,
      options: [ { maxLength: 10 } ]
    }
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
    },
    {
      code: dedent`
        function f() {
          if (x) {
            return null
          }
          return compute()
        }
      `,
      output: dedent`
        function f() {
          if (x) return null
          return compute()
        }
      `,
      errors: [ { messageId: "compactGuardClause" } ]
    },
    {
      code: dedent`
        function f(items) {
          for (const item of items) {
            if (item.skip) {
              continue
            }
            handle(item)
          }
        }
      `,
      output: dedent`
        function f(items) {
          for (const item of items) {
            if (item.skip) continue
            handle(item)
          }
        }
      `,
      errors: [ { messageId: "compactGuardClause" } ]
    },
    {
      code: dedent`
        function f(items) {
          for (const item of items) {
            if (item.stop) {
              break
            }
            handle(item)
          }
        }
      `,
      output: dedent`
        function f(items) {
          for (const item of items) {
            if (item.stop) break
            handle(item)
          }
        }
      `,
      errors: [ { messageId: "compactGuardClause" } ]
    }
  ]
})
