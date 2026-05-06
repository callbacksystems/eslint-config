import rule from "#rules/prefer-positive-wrap"
import { dedent, tester } from "#test/helpers"

tester.run("prefer-positive-wrap", rule, {
  valid: [
    dedent`
      function f(x) {
        if (!x) return
        longHappyPath()
        doMore()
        andMore()
        andEvenMore()
        andOneMoreLine()
      }
    `,
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
      errors: [ { messageId: "preferPositiveWrap" } ]
    }
  ]
})
