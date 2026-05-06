import rule from "#rules/no-mid-function-returns"
import { dedent, tester } from "#test/support"

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
    `
  ],
  invalid: [
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
    }
  ]
})
