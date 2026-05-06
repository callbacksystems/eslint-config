import rule from "#rules/prefer-positive-wrap"
import { dedent, tester } from "#test/support"

tester.run("prefer-positive-wrap", rule, {
  valid: [
    // Value-return guard but the happy path does not exit: the trailing return would
    // also fire on the positive case, changing semantics. Left for a human.
    dedent`
      function f(x) {
        if (!x) return null
        happyPath()
      }
    `,
    dedent`
      function f(x) {
        if (x) return doSomething()
      }
    `,
    // The happy path is already three levels deep; wrapping would push it past
    // `max-depth` (3), so the rule defers to that constraint.
    dedent`
      function f(x) {
        if (!x) return
        if (a) {
          if (b) {
            if (c) {
              doStuff()
            }
          }
        }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        function f(x) {
          if (!x) return
          doSomething()
        }
      `,
      output: dedent`
        function f(x) {
          if (x) {
            doSomething()
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (!ready) return
          start()
          finish()
        }
      `,
      output: dedent`
        function f(x) {
          if (ready) {
            start()
            finish()
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    // Value-return guard with a happy path ending in `return`: wrap and keep the
    // guard's value in an explicit `else`, so the negative case still returns it
    // and the whole function stays a single if/else statement.
    {
      code: dedent`
        function f(x) {
          if (!x) return null
          const value = compute()
          return value
        }
      `,
      output: dedent`
        function f(x) {
          if (x) {
            const value = compute()
            return value
          } else {
            return null
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    // The analysis-class pattern that pervades this repo: precondition guard, then
    // build and return a descriptor.
    {
      code: dedent`
        function f(x) {
          if (!ready) return null
          return { ok: true }
        }
      `,
      output: dedent`
        function f(x) {
          if (ready) {
            return { ok: true }
          } else {
            return null
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    }
  ]
})
