import rule from "#rules/no-redundant-trailing-return"
import { dedent, tester } from "#support"

tester.run("no-redundant-trailing-return", rule, {
  valid: [
    dedent`
      function f(x) {
        if (x) return 1
        return 2
      }
    `,
    dedent`
      function f() {
        doSomething()
      }
    `,
    dedent`
      function f(x) {
        if (x) return "value"
        return null
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        function f() {
          doSomething()
          return null
        }
      `,
      output: dedent`
        function f() {
          doSomething()
        }
      `,
      errors: [ { messageId: "redundantTrailingReturn" } ]
    },
    {
      code: dedent`
        function f() {
          doSomething()
          return undefined
        }
      `,
      output: dedent`
        function f() {
          doSomething()
        }
      `,
      errors: [ { messageId: "redundantTrailingReturn" } ]
    },
    {
      code: dedent`
        function f() {
          doSomething()
          return
        }
      `,
      output: dedent`
        function f() {
          doSomething()
        }
      `,
      errors: [ { messageId: "redundantTrailingReturn" } ]
    }
  ]
})
