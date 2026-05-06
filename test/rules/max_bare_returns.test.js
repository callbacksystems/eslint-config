import rule from "#rules/max_bare_returns"
import { dedent, tester } from "#support"

tester.run("max-bare-returns", rule, {
  valid: [
    "function f() { if (!a) return }",
    "function f() {}",
    // One upfront guard, the rest written positively.
    dedent`
      function f() {
        if (!ready) return
        if (active) doWork()
      }
    `,
    // Value-returning returns are not counted.
    dedent`
      function f(x) {
        if (x === 1) return "a"
        if (x === 2) return "b"
        return "c"
      }
    `,
    // One bare return here, one in a nested function: counted separately.
    dedent`
      function outer() {
        if (!a) return
        return [].forEach((item) => {
          if (!item) return
        })
      }
    `,
    // A higher `max` tolerates more.
    { code: "function f() { if (!a) return; if (!b) return }", options: [ { max: 2 } ] }
  ],
  invalid: [
    {
      code: dedent`
        function f() {
          if (!a) return
          if (!b) return
        }
      `,
      errors: [ { messageId: "tooManyBareReturns", data: { count: 2, max: 1 } } ]
    },
    {
      code: dedent`
        function f() {
          if (!a) return
          doWork()
          if (!b) return
          more()
          if (!c) return
        }
      `,
      errors: [ { messageId: "tooManyBareReturns", data: { count: 3, max: 1 } } ]
    }
  ]
})
