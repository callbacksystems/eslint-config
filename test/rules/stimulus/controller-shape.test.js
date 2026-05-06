import rule from "#rules/stimulus/controller-shape"
import { dedent, tester } from "#test/support"

tester.run("stimulus-controller-shape", rule, {
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
      errors: [ { messageId: "outOfOrder" } ]
    },
    {
      code: dedent`
        class Bad extends Controller {
          #cleanup() {}
          static targets = [ "input" ]
        }
      `,
      errors: [ { messageId: "outOfOrder" } ]
    }
  ]
})
