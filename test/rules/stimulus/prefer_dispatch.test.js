import rule from "#rules/stimulus/prefer_dispatch"
import { dedent, tester } from "#support"

tester.run("stimulus/prefer-dispatch", rule, {
  valid: [
    dedent`
      class Foo {
        connect() {
          this.element.dispatchEvent(new CustomEvent("click"))
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        connect() {
          this.dispatch("change", { detail: { value: 1 } })
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        static targets = [ "input" ]
        connect() {
          this.inputTarget.dispatchEvent(new CustomEvent("change"))
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        connect() {
          document.dispatchEvent(new CustomEvent("global"))
        }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        class Foo extends Controller {
          submit() {
            this.element.dispatchEvent(new CustomEvent("submitted", { detail: { ok: true } }))
          }
        }
      `,
      errors: [ { messageId: "preferDispatch", data: { event: "submitted" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          bubble(event) {
            this.element.dispatchEvent(event)
          }
        }
      `,
      errors: [ { messageId: "preferDispatch", data: { event: "event" } } ]
    }
  ]
})
