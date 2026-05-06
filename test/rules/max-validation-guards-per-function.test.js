import rule from "#rules/max-validation-guards-per-function"
import { dedent, tester } from "#support"

tester.run("max-validation-guards-per-function", rule, {
  valid: [
    "function f() {}",
    "function f(a) { if (!a) return null }",
    "function f(a, b) { if (!a) return; if (!b) return null }",
    dedent`
      function f(a) {
        if (a === 1) return "one"
        if (a === 2) return "two"
        if (a === 3) return "three"
        return "other"
      }
    `,
    // A higher `max` allows more guards.
    { code: "function f(a, b, c) { if (!a) return; if (!b) return; if (!c) return null }", options: [ { max: 3 } ] }
  ],
  invalid: [
    {
      code: dedent`
        function f(a, b, c) {
          if (!a) return null
          if (!b) return null
          if (!c) return null
        }
      `,
      errors: [ { messageId: "tooManyGuards" } ]
    },
    // A lower `max` flags fewer guards.
    {
      code: "function f(a, b) { if (!a) return; if (!b) return null }",
      options: [ { max: 1 } ],
      errors: [ { messageId: "tooManyGuards" } ]
    }
  ]
})
