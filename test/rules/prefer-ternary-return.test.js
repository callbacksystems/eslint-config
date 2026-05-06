import rule from "#rules/prefer-ternary-return"
import { dedent, tester } from "#test/helpers"

tester.run("prefer-ternary-return", rule, {
  valid: [
    dedent`
      function f(x) {
        if (x) return
        return 1
      }
    `,
    dedent`
      function f(x) {
        if (a) return 1
        if (b) return 2
        return 3
      }
    `,
    dedent`
      function f(x) {
        if (x) return { a: 1, b: 2, c: 3 }
        return { d: 4, e: 5 }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        function f(x) {
          if (x) return "yes"
          return "no"
        }
      `,
      errors: [ { messageId: "preferTernaryReturn" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (x) return false
          return computeFallback()
        }
      `,
      errors: [ { messageId: "preferTernaryReturn" } ]
    }
  ]
})
