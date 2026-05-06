import rule from "#rules/stimulus/no-imperative-event-listener"
import { dedent, tester } from "#support"

tester.run("stimulus/no-imperative-event-listener", rule, {
  valid: [
    dedent`
      class Foo {
        connect() {
          this.element.addEventListener("click", this.onClick)
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        connect() {
          this.element.addEventListener("click", this.onClick, { once: true })
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        connect() {
          this.element.addEventListener("scroll", this.onScroll, { passive: true })
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        connect() {
          this.element.addEventListener("abort", this.onAbort, { signal: this.controller.signal })
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        static targets = [ "input" ]
        connect() {
          // No imperative listener; actions live in data-action.
        }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        class Foo extends Controller {
          connect() {
            this.element.addEventListener("click", this.onClick)
          }
        }
      `,
      errors: [ { messageId: "imperativeListener", data: { event: "click" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static targets = [ "input" ]
          connect() {
            this.inputTarget.addEventListener("change", this.onChange)
          }
        }
      `,
      errors: [ { messageId: "imperativeListener", data: { event: "change" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          connect() {
            window.addEventListener("resize", this.onResize)
          }
        }
      `,
      errors: [ { messageId: "imperativeListener", data: { event: "resize" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static targets = [ "row" ]
          rowTargetConnected(row) {
            row.addEventListener("click", this.onRowClick)
          }
        }
      `,
      errors: [ { messageId: "imperativeListener", data: { event: "click" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          connect() {
            this.element.addEventListener("click", this.onClick, { capture: true })
          }
        }
      `,
      errors: [ { messageId: "imperativeListener", data: { event: "click" } } ]
    }
  ]
})
