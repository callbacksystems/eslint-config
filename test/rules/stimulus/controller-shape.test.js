import rule from "#rules/stimulus/controller-shape"
import { dedent, tester } from "#test/support"

tester.run("stimulus/controller-shape", rule, {
  valid: [
    dedent`
      class Other extends Whatever {
        method() {}
        connect() {}
      }
    `,
    dedent`
      class Foo extends Controller {
        static targets = [ "input" ]
        static values = { open: Boolean }
        #timer = null
        connect() {}
        inputTargetConnected() {}
        openValueChanged() {}
        submit() {}
        get isOpen() {}
        #cleanup() {}
      }
    `,
    dedent`
      class Bar extends Controller {
        static targets = [ "x" ]
        connect() {}
        click() {}
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        class Bad extends Controller {
          submit() {}
          connect() {}
        }
      `,
      output: dedent`
        class Bad extends Controller {
          connect() {}
          submit() {}
        }
      `,
      errors: [ { messageId: "outOfOrder" } ]
    },
    {
      code: dedent`
        class Bad extends Controller {
          #cleanup() {}
          static targets = [ "input" ]
        }
      `,
      output: dedent`
        class Bad extends Controller {
          static targets = [ "input" ]
          #cleanup() {}
        }
      `,
      errors: [ { messageId: "outOfOrder" } ]
    },
    // Reordering carries each member's own-line leading comment with it.
    {
      code: dedent`
        class Bad extends Controller {
          // submits the form
          submit() {}
          // wires up listeners
          connect() {}
        }
      `,
      output: dedent`
        class Bad extends Controller {
          // wires up listeners
          connect() {}
          // submits the form
          submit() {}
        }
      `,
      errors: [ { messageId: "outOfOrder" } ]
    }
  ]
})
