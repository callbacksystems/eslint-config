import rule from "#rules/no-effectful-bare-return"
import { dedent, tester } from "#test/support"

tester.run("no-effectful-bare-return", rule, {
  valid: [
    // An inline guard exits before any work: the good shape.
    "function f() { if (done) return }",
    // A single-statement guard block carries no work; it is collapsed elsewhere.
    "function f() { if (done) { return } }",
    // The branch returns a real value, not a bare bail-out.
    dedent`
      function f() {
        if (ready) {
          prepare()
          return result
        }
      }
    `,
    // The branch does work but never returns.
    dedent`
      function f() {
        if (ready) {
          prepare()
          finish()
        }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        function f() {
          if (something) {
            anotherThing()
            return
          }
        }
      `,
      errors: [ { messageId: "effectfulBareReturn" } ]
    },
    {
      // The same smell in an else branch.
      code: dedent`
        function f() {
          if (ready) {
            start()
          } else {
            reset()
            return
          }
        }
      `,
      errors: [ { messageId: "effectfulBareReturn" } ]
    },
    {
      // Both branches offend independently.
      code: dedent`
        function f() {
          if (ready) {
            start()
            return
          } else {
            reset()
            return
          }
        }
      `,
      errors: [ { messageId: "effectfulBareReturn" }, { messageId: "effectfulBareReturn" } ]
    }
  ]
})
