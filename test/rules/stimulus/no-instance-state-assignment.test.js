import rule from "#rules/stimulus/no-instance-state-assignment"
import { dedent, tester } from "#support"

tester.run("stimulus/no-instance-state-assignment", rule, {
  valid: [
    dedent`
      class Foo {
        connect() {
          this.bar = 1
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        #observer
        connect() {
          this.#observer = new MutationObserver(() => {})
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        static values = { open: Boolean }
        toggle() {
          this.openValue = !this.openValue
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        static classes = [ "active" ]
        mark() {
          this.activeClass = "is-active"
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        static values = { items: Array }
        push(item) {
          this.itemsValue.push(item)
        }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        class Foo extends Controller {
          connect() {
            this.stripeElements = stripe.elements()
          }
        }
      `,
      errors: [ { messageId: "instanceState", data: { name: "stripeElements" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          connect() {
            this.observer = new MutationObserver(() => {})
          }
        }
      `,
      errors: [ { messageId: "instanceState", data: { name: "observer" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static values = { count: Number }
          increment() {
            this.total = this.countValue + 1
          }
        }
      `,
      errors: [ { messageId: "instanceState", data: { name: "total" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          cache(key, value) {
            this.cache ??= new Map()
            this.cache.set(key, value)
          }
        }
      `,
      errors: [ { messageId: "instanceState", data: { name: "cache" } } ]
    }
  ]
})
