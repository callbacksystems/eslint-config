import rule from "#rules/stimulus/static-config-keys-camelcase"
import { dedent, tester } from "#test/support"

tester.run("stimulus/static-config-keys-camelcase", rule, {
  valid: [
    dedent`
      class Foo extends Controller {
        static targets = [ "input", "submitButton" ]
      }
    `,
    dedent`
      class Foo extends Controller {
        static values = { isOpen: Boolean, maxItems: Number }
      }
    `,
    dedent`
      class Foo extends Controller {
        static classes = [ "active", "loadingState" ]
      }
    `,
    dedent`
      class Other {
        static targets = [ "snake_case", "kebab-case" ]
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        class Foo extends Controller {
          static targets = [ "submit_button" ]
        }
      `,
      errors: [ { messageId: "notCamelCase" } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static classes = [ "active-state" ]
        }
      `,
      errors: [ { messageId: "notCamelCase" } ]
    }
  ]
})
