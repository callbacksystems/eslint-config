import rule from "#rules/stimulus/no_imperative_event_listener"
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
          matchMedia("(prefers-reduced-motion: reduce)")
            .addEventListener("change", this.update, { signal: this.abort.signal })
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        connect() {
          visualViewport.addEventListener("resize", this.reposition)
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        static targets = [ "results" ]
        reload() {
          this.resultsTarget.addEventListener("turbo:frame-load", this.restoreFocus, { once: true })
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        open() {
          document.addEventListener("click", this.close, { signal: this.abort.signal })
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        queryValueChanged() {
          this.element.addEventListener("turbo:frame-load", this.announce, { once: true })
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        static targets = [ "input" ]
        connect() {}
      }
    `,
    // A connected callback without the element parameter has nothing for the receiver to match.
    dedent`
      class Foo extends Controller {
        static targets = [ "row" ]
        rowTargetConnected() {
          mediaQuery.addEventListener("change", this.update)
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
      errors: [ { messageId: "wireInHtml", data: { event: "click" } } ]
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
      errors: [ { messageId: "wireInHtml", data: { event: "change" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          connect() {
            this.element.addEventListener(this.eventValue, this.onEvent)
          }
        }
      `,
      errors: [ { messageId: "wireInHtml", data: { event: "event" } } ]
    },
    // A field's arrow function is no method, so the listener it registers is scoped to nothing.
    {
      code: dedent`
        class Foo extends Controller {
          #watch = () => {
            document.addEventListener("click", this.close)
          }
        }
      `,
      errors: [ { messageId: "unscopedListener", data: { event: "click" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          connect() {
            window.addEventListener("resize", this.onResize)
          }
        }
      `,
      errors: [ { messageId: "wireInHtml", data: { event: "resize" } } ]
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
      errors: [ { messageId: "wireInHtml", data: { event: "click" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          connect() {
            this.element.addEventListener("click", this.onClick, { capture: true })
          }
        }
      `,
      errors: [ { messageId: "wireInHtml", data: { event: "click" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          connect() {
            this.element.addEventListener("click", this.onClick, { once: true })
          }
        }
      `,
      errors: [ { messageId: "wireInHtml", data: { event: "click" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          connect() {
            this.element.addEventListener("scroll", this.onScroll, { passive: true })
          }
        }
      `,
      errors: [ { messageId: "wireInHtml", data: { event: "scroll" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          initialize() {
            this.element.addEventListener("abort", this.onAbort, { signal: this.abort.signal })
          }
        }
      `,
      errors: [ { messageId: "wireInHtml", data: { event: "abort" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static targets = [ "row" ]
          rowOutletConnected(outlet, row) {
            outlet.addEventListener("click", this.onRowClick, { once: true })
          }
        }
      `,
      errors: [ { messageId: "wireInHtml", data: { event: "click" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          open() {
            document.addEventListener("click", this.close)
          }
        }
      `,
      errors: [ { messageId: "unscopedListener", data: { event: "click" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static targets = [ "row" ]
          select() {
            this.rowTargets[0].addEventListener("click", this.onRowClick)
          }
        }
      `,
      errors: [ { messageId: "unscopedListener", data: { event: "click" } } ]
    }
  ]
})
