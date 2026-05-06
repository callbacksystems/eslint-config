import rule from "#rules/no_mid_function_returns"
import { dedent, tester } from "#support"

tester.run("no-mid-function-returns", rule, {
  valid: [
    dedent`
      function f() {
        return 1
      }
    `,
    dedent`
      function f(x) {
        if (!x) return null
        const y = x * 2
        return y
      }
    `,
    dedent`
      function f(event) {
        event.preventDefault()
        event.stopPropagation()
        const x = 1
        return x
      }
    `,
    // A higher `maxLeadingCalls` widens the boilerplate zone before guards.
    {
      code: dedent`
        function f(x) {
          a()
          b()
          c()
          if (!x) return null
          return x
        }
      `,
      options: [ { maxLeadingCalls: 3 } ]
    }
  ],
  invalid: [
    // A `try` hides nothing: an exit inside its block, its handler or its `finally` is as mid-function as any.
    {
      code: dedent`
        function f() {
          open()
          try {
            if (quick) return early
            finish()
          } finally {
            cleanup()
          }
          close()
        }
      `,
      errors: [ { messageId: "midFunctionReturn" } ]
    },
    {
      code: dedent`
        function f() {
          open()
          try {
            finish()
          } catch (error) {
            return report(error)
          }
          close()
        }
      `,
      errors: [ { messageId: "midFunctionReturn" } ]
    },
    {
      code: dedent`
        function f(x) {
          const y = x * 2
          doSomething()
          if (y > 100) return "big"
          doMore()
          return y
        }
      `,
      errors: [ { messageId: "midFunctionReturn" } ]
    },
    {
      code: dedent`
        function f(x) {
          const y = x * 2
          doSomething()
          if (y > 100) throw new Error("oops")
          return y
        }
      `,
      errors: [ { messageId: "midFunctionReturn" } ]
    },
    {
      code: dedent`
        function f() {
          open()
          work: {
            if (ready) return value
          }
          close()
        }
      `,
      errors: [ { messageId: "midFunctionReturn" } ]
    }
  ]
})
