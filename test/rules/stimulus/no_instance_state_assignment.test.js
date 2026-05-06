import rule from "#rules/stimulus/no_instance_state_assignment"
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
    `,
    dedent`
      class Foo extends Controller {
        static values = { "open": Boolean }
        toggle() {
          this.openValue = !this.openValue
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        connect() {
          function update() {
            this.foreignState = true
          }
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        static connect() {
          this.constructorState = true
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        connect() {
          class Nested {
            update() {
              this.ownState = true
            }
          }
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        static ["values"] = { ["open"]: Boolean, ["count"]: Number }
        static ["classes"] = [ "active" ]
        update() {
          this["openValue"] = true
          this.countValue++
          this["activeClass"] = "visible"
        }
      }
    `,
    dedent`
      const config = "values"
      const value = "open"
      class Foo extends Controller {
        static [config] = { [value]: Boolean }
        toggle() {
          this.openValue = !this.openValue
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        update(key) {
          this[key] = value
          this["not-private-safe"] = value
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        static state = (this.constructorState = true)

        static {
          this.otherConstructorState = true
        }
      }
    `,
    dedent`
      class Foo extends Controller {
        connect() {
          function build() {
            return class Nested extends (this.Base = Object) {
              [this.key = "value"]() {}
            }
          }

          return build
        }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        const state = "observer"
        class Foo extends Controller {
          connect() {
            this[state] = new MutationObserver(() => {})
          }
        }
      `,
      errors: [ { messageId: "instanceState", data: { name: "observer" } } ]
    },
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
    },
    {
      code: dedent`
        class Foo extends Controller {
          connect() {
            run(() => {
              this.observer = buildObserver()
            })
          }
        }
      `,
      errors: [ { messageId: "instanceState", data: { name: "observer" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          update() {
            this["observer"] = buildObserver()
            this.total++
            delete this.cache
          }
        }
      `,
      errors: [
        { messageId: "instanceState", data: { name: "observer" } },
        { messageId: "instanceState", data: { name: "total" } },
        { messageId: "instanceState", data: { name: "cache" } }
      ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          update(source) {
            ({ value: this.value, nested: [ this.other ] } = source)
          }
        }
      `,
      errors: [
        { messageId: "instanceState", data: { name: "value" } },
        { messageId: "instanceState", data: { name: "other" } }
      ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          update(items) {
            for (this.item of items) use(this.item)
          }
        }
      `,
      errors: [ { messageId: "instanceState", data: { name: "item" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          state = (this.instanceState = true)

          handler = () => {
            this.arrowState = true
          }
        }
      `,
      errors: [
        { messageId: "instanceState", data: { name: "instanceState" } },
        { messageId: "instanceState", data: { name: "arrowState" } }
      ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          connect(value = (this.defaultState = true)) {
            class FromKey {
              [this.keyState = true]() {}
            }

            class FromHeritage extends (this.Base = Object) {}
          }
        }
      `,
      errors: [
        { messageId: "instanceState", data: { name: "defaultState" } },
        { messageId: "instanceState", data: { name: "keyState" } },
        { messageId: "instanceState", data: { name: "Base" } }
      ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static values = [ "open" ]
          static classes = { active: String }
          update() {
            this.openValue = true
            this.activeClass = "visible"
            this.π = 3
          }
        }
      `,
      errors: [
        { messageId: "instanceState", data: { name: "openValue" } },
        { messageId: "instanceState", data: { name: "activeClass" } },
        { messageId: "instanceState", data: { name: "π" } }
      ]
    },
    { name: "indexes writes once across deeply nested controllers", code: nestedControllers(400), errors: 400 }
  ]
})

function nestedControllers(count) {
  return Array.from({ length: count }, (_, index) => count - index - 1).reduce(
    (inner, index) => `class C${index} extends Controller { update() { this.state${index} = true; ${inner} } }`, ""
  )
}
