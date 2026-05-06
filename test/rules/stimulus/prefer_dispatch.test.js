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
    `,
    dedent`
      class Foo extends Controller {
        connect() {
          function later() {
            this.element.dispatchEvent(new CustomEvent("foreign"))
          }
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        static notify() {
          this.element.dispatchEvent(new CustomEvent("static"))
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        #dispatchEvent() {}
        notify(event) {
          this.element.#dispatchEvent(event)
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        #element = receiver
        notify(event) {
          this.#element.dispatchEvent(event)
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        bubble(event) {
          this.element.dispatchEvent(event)
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        submit() {
          return this.element.dispatchEvent(new CustomEvent("submitted"))
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        submit() {
          const wasAccepted = this.element.dispatchEvent(new CustomEvent("submitted"))
          return wasAccepted
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        submit() {
          if (this.element.dispatchEvent(new CustomEvent("submitted"))) proceed()
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        submit() {
          this.element.dispatchEvent(new Event("submitted"))
        }
      }
    `,
    "class Foo extends Controller { submit() { this.element?.dispatchEvent(new CustomEvent('submitted')) } }",
    "class Foo extends Controller { submit() { this.element.dispatchEvent?.(new CustomEvent('submitted')) } }",
    dedent`
      class CustomEvent {}
      class Foo extends Controller {
        submit() {
          this.element.dispatchEvent(new CustomEvent("submitted"))
        }
      }
    `,
    dedent`
      class CustomEvent {}
      const event = new CustomEvent("submitted")
      class Foo extends Controller {
        submit() {
          this.element.dispatchEvent(event)
        }
      }
    `,
    dedent`
      let event = new CustomEvent("submitted")
      event = replacement
      class Foo extends Controller {
        submit() {
          this.element.dispatchEvent(event)
        }
      }
    `,
    dedent`
      CustomEvent = LocalEvent
      const event = new CustomEvent("submitted")
      class Foo extends Controller {
        submit() {
          this.element.dispatchEvent(event)
        }
      }
    `,
    dedent`
      globalThis.CustomEvent = LocalEvent
      const event = new CustomEvent("submitted")
      class Foo extends Controller {
        submit() {
          this.element.dispatchEvent(event)
        }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        let event = new CustomEvent("submitted")
        class Foo extends Controller {
          submit() {
            this.element.dispatchEvent(event)
          }
        }
      `,
      errors: [ { messageId: "preferDispatch", data: { event: "submitted" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          submit() {
            let event = new CustomEvent("submitted")
            this.element.dispatchEvent(event)
            event = replacement
          }
        }
      `,
      errors: [ { messageId: "preferDispatch", data: { event: "submitted" } } ]
    },
    {
      code: dedent`
        const event = new CustomEvent("submitted")
        class Foo extends Controller {
          submit() {
            this.element.dispatchEvent(event)
          }
        }
      `,
      errors: [ { messageId: "preferDispatch", data: { event: "submitted" } } ]
    },
    {
      code: dedent`
        const original = new CustomEvent("ready")
        const event = original
        class Foo extends Controller {
          submit() {
            this.element.dispatchEvent(event)
          }
        }
      `,
      errors: [ { messageId: "preferDispatch", data: { event: "ready" } } ]
    },
    {
      code: dedent`
        const element = "element"
        const dispatch = "dispatchEvent"
        const EventConstructor = CustomEvent
        class Foo extends Controller {
          submit() {
            this[element][dispatch](new EventConstructor("submitted"))
          }
        }
      `,
      errors: [ { messageId: "preferDispatch", data: { event: "submitted" } } ]
    },
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
          notify(name) {
            this.element.dispatchEvent(new CustomEvent(name))
          }
        }
      `,
      errors: [ { messageId: "preferDispatch", data: { event: "event" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          notify = () => {
            this.element.dispatchEvent(new CustomEvent("ready"))
          }
        }
      `,
      errors: [ { messageId: "preferDispatch", data: { event: "ready" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          notify() {
            this["element"]["dispatchEvent"](new CustomEvent("ready"))
          }
        }
      `,
      errors: [ { messageId: "preferDispatch", data: { event: "ready" } } ]
    }
  ]
})
