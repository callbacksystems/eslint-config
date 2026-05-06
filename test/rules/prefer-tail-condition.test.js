import rule from "#rules/prefer-tail-condition"
import { dedent, tester } from "#test/support"

tester.run("prefer-tail-condition", rule, {
  valid: [
    dedent`
      function f(x) {
        if (!x) return 1
      }
    `,
    dedent`
      function f(x) {
        if (x) return 1
        return 2
      }
    `,
    dedent`
      function f(x) {
        doSomething()
        return x
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        function f(x) {
          if (x) return
          return computeValue()
        }
      `,
      errors: [ { messageId: "preferTailCondition" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (x) {
            return
          }
          return computeValue()
        }
      `,
      errors: [ { messageId: "preferTailCondition" } ]
    }
  ]
})
