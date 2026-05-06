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
    `,
    dedent`
      class Foo extends Controller {
        rowOutletConnected(outlet, row) {
          outlet.addEventListener("click", this.select)
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        connect() {
          const window = frame
          window.addEventListener("resize", this.resize)
        }
      }
    `,
    dedent`
      document = frame
      class Foo extends Controller {
        connect() {
          document.addEventListener("click", this.close)
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        open() {
          document.addEventListener("click", this.close, { "once": true })
        }
      }
    `,
    dedent`
      const option = "once"
      class Foo extends Controller {
        open() {
          document.addEventListener("click", this.close, { [option]: true })
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        connect() {
          run(function () {
            this.element.addEventListener("click", this.click)
          })
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        static connect() {
          window.addEventListener("resize", this.resize)
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        connect() {
          run(function () {
            window.addEventListener("resize", this.resize)
          })
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        open() {
          this.rowTarget["shadowRoot"].addEventListener("click", this.select)
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        rowTargetConnected(row) {
          {
            const row = externalRow
            row.addEventListener("click", this.select)
          }
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        #addEventListener() {}
        connect() {
          this.element.#addEventListener("click", this.select)
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        #rowTarget = receiver
        connect() {
          this.#rowTarget.addEventListener("click", this.select)
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        open(signal) {
          document.addEventListener("click", this.close, { signal })
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        open() {
          const signal = maybeSignal
          document.addEventListener("click", this.close, { signal })
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        open() {
          let signal
          signal = this.abort.signal
          document.addEventListener("click", this.close, { signal })
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        open() {
          const undefined = this.abort.signal
          document.addEventListener("click", this.close, { signal: undefined })
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        open() {
          document.addEventListener("click", this.close, { signal: signalFor() })
        }
      }
    `,
    dedent`
      const first = second
      const second = first
      class Foo extends Controller {
        open() {
          document.addEventListener("click", this.close, { signal: first })
        }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        const element = "element"
        const add = "addEventListener"
        class Foo extends Controller {
          connect() {
            this[element][add]("click", this.onClick)
          }
        }
      `,
      errors: [ { messageId: "wireInHtml", data: { event: "click" } } ]
    },
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
        const hook = "connect"
        class Foo extends Controller {
          [hook]() {
            this.element.addEventListener("click", this.onClick)
          }
        }
      `,
      errors: [ { messageId: "wireInHtml", data: { event: "click" } } ]
    },
    {
      code: dedent`
        const hook = "rowTargetConnected"
        class Foo extends Controller {
          [hook](row) {
            row.addEventListener("click", this.select)
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
          open = function () {
            document.addEventListener("click", this.close)
          }
        }
      `,
      errors: [ { messageId: "unscopedListener", data: { event: "click" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          open = async function () {
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
    },
    {
      code: dedent`
        class Foo extends Controller {
          open() {
            document.addEventListener("click", this.close, { once: false })
          }
        }
      `,
      errors: [ { messageId: "unscopedListener" } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          open() {
            document.addEventListener("click", this.close, { signal: undefined })
          }
        }
      `,
      errors: [ { messageId: "unscopedListener" } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          open() {
            let signal
            document.addEventListener("click", this.close, { signal })
          }
        }
      `,
      errors: [ { messageId: "unscopedListener" } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          open() {
            const signal = undefined
            document.addEventListener("click", this.close, { signal })
          }
        }
      `,
      errors: [ { messageId: "unscopedListener" } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          open() {
            const missingSignal = undefined
            const signal = missingSignal
            document.addEventListener("click", this.close, { signal })
          }
        }
      `,
      errors: [ { messageId: "unscopedListener" } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          open() {
            const signal = void 0
            document.addEventListener("click", this.close, { signal })
          }
        }
      `,
      errors: [ { messageId: "unscopedListener" } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          open() {
            const signal = undefined
            document.addEventListener("click", this.close, { signal })
            document.addEventListener("keydown", this.close, { signal })
          }
        }
      `,
      errors: [ { messageId: "unscopedListener" }, { messageId: "unscopedListener" } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          connect() {
            run(() => {
              this.element.addEventListener("click", this.click)
            })
          }
        }
      `,
      errors: [ { messageId: "unscopedListener" } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          rowOutletConnected(outlet, row) {
            row.addEventListener("click", this.select)
          }
        }
      `,
      errors: [ { messageId: "wireInHtml" } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          ['connect']() {
            this['element']['addEventListener']("click", this.click)
          }
        }
      `,
      errors: [ { messageId: "wireInHtml", data: { event: "click" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          open() {
            document["addEventListener"]("click", this.close, { ["once"]: false })
          }
        }
      `,
      errors: [ { messageId: "unscopedListener", data: { event: "click" } } ]
    },
    {
      name: "resolves deep undefined signal aliases iteratively",
      code: undefinedSignalAliases(5_000),
      errors: [ { messageId: "unscopedListener" } ]
    },
    { name: "indexes deeply nested listener contexts once", code: nestedListeners(500), errors: 500 }
  ]
})

function undefinedSignalAliases(count) {
  return [
    "const signal0 = undefined",
    ...Array.from({ length: count }, (_, index) => `const signal${index + 1} = signal${index}`),
    `class Foo extends Controller {
      open() {
        document.addEventListener("click", this.close, { signal: signal${count} })
      }
    }`
  ].join("\n")
}

function nestedListeners(count) {
  return [
    "class Foo extends Controller { open() {",
    ...Array.from({ length: count }, () => '{ document.addEventListener("click", this.close)'),
    "}".repeat(count),
    "} }"
  ].join("\n")
}
