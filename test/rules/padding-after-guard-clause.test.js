import rule from "#rules/padding-after-guard-clause"
import { dedent, tester } from "#test/support"

tester.run("padding-after-guard-clause", rule, {
  valid: [
    dedent`
      function f(x) {
        if (!x) return

        doSomething()
      }
    `,
    dedent`
      function f(x, y) {
        if (!x) return
        if (!y) return

        doSomething()
      }
    `,
    dedent`
      function f(x) {
        if (!x) return
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
          if (!x) return

          doSomething()
        }
      `,
      errors: [ { messageId: "expectedBlankLine" } ]
    }
  ]
})
