import rule from "#rules/step_down_methods"
import { dedent, tester } from "#support"

tester.run("step-down-methods", rule, {
  valid: [
    // A public getter read only by a private helper stays among the public members.
    dedent`
      class C {
        get problem() { return this.#isReady ? 1 : null }
        get name() { return this.value }
        get #isReady() { return this.name === "ready" }
      }
    `,
    {
      code: dedent`
        class C {
          toggle() {
            return this.isOpen
          }

          reset() {}

          get isOpen() {
            return true
          }
        }
      `,
      options: [ { separateAccessors: true } ]
    },
    // Name-grouped members keep their order among themselves: the rule that drew the group owns it.
    {
      code: dedent`
        class C {
          disconnectedCallback() {
            this.connectedCallback()
          }

          connectedCallback() {}
        }
      `,
      options: [ { nameGroups: [ "Callback$" ] } ]
    },
    {
      code: dedent`
        class C {
          connectedCallback() {
            this.close()
          }

          formResetCallback() {
            this.close()
          }

          close() {}
        }
      `,
      options: [ { nameGroups: [ "^(connected|disconnected)Callback$", "^form.+Callback$" ] } ]
    },
    // Reordering two members of one name would drop one of them, so the group is left alone.
    dedent`
      class C {
        run() {
          this.helper()
        }

        other() {}

        helper() { return 1 }

        helper() { return 2 }
      }
    `,
    // A computed access names no member, so it seeds nothing.
    dedent`
      class C {
        run() {
          this[action]()
        }

        helper() {}
      }
    `,
    // A computed key is unknowable here, and it evaluates in source order.
    dedent`
      class C {
        run() {
          this.helper()
        }

        [key]() { return 1 }

        helper() {}
      }
    `,
    dedent`
      class C {
        run() {
          this.#step()
        }

        #step() {
          this.#detail()
        }

        #detail() {}
      }
    `,
    dedent`
      class C {
        zebra() {}
        apple() {}
      }
    `,
    dedent`
      class C {
        only() {
          this.#helper()
        }

        #helper() {}
      }
    `,
    dedent`
      class C {
        act() {
          return this.ready
        }

        get ready() {
          return true
        }
      }
    `,
    dedent`
      class C {
        static get primary() {
          return this.secondary
        }

        static get secondary() {
          return true
        }
      }
    `,
    dedent`
      class C {
        first() {
          return this.value
        }

        get value() {
          return 1
        }

        set value(next) {
          this.stored = next
        }

        second() {}
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        class C {
          first() { this.second() } // about first
          third() {} // about third
          second() {} // about second
        }
      `,
      output: dedent`
        class C {
          first() { this.second() } // about first
          second() {} // about second
          third() {} // about third
        }
      `,
      errors: [ { messageId: "outOfOrder" } ]
    },
    {
      code: dedent`
        class C {
          run() {
            this.#step()
          }

          #detail() {}

          #step() {
            this.#detail()
          }
        }
      `,
      output: dedent`
        class C {
          run() {
            this.#step()
          }

          #step() {
            this.#detail()
          }

          #detail() {}
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "#step", before: "#detail" } } ]
    },
    {
      code: dedent`
        class C {
          constructor() {
            this.#first()
            this.#second()
          }

          #second() {}

          #first() {}
        }
      `,
      output: dedent`
        class C {
          constructor() {
            this.#first()
            this.#second()
          }

          #first() {}

          #second() {}
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "#first", before: "#second" } } ]
    },
    {
      code: dedent`
        class C {
          static get secondary() {
            return true
          }

          static get primary() {
            return this.secondary
          }
        }
      `,
      output: dedent`
        class C {
          static get primary() {
            return this.secondary
          }

          static get secondary() {
            return true
          }
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "primary", before: "secondary" } } ]
    },
    {
      code: dedent`
        class C {
          get ready() {
            return true
          }

          act() {
            return this.ready
          }
        }
      `,
      output: dedent`
        class C {
          act() {
            return this.ready
          }

          get ready() {
            return true
          }
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "act", before: "ready" } } ]
    },
    {
      code: dedent`
        class C {
          first() {
            return this.value
          }

          second() {}

          get value() {
            return 1
          }

          set value(next) {
            this.stored = next
          }
        }
      `,
      output: dedent`
        class C {
          first() {
            return this.value
          }

          get value() {
            return 1
          }

          set value(next) {
            this.stored = next
          }

          second() {}
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "value", before: "second" } } ]
    },
    {
      code: dedent`
        class C {
          get value() {
            return 1
          }

          first() {
            return this.value
          }

          set value(next) {
            this.stored = next
          }
        }
      `,
      output: dedent`
        class C {
          first() {
            return this.value
          }

          get value() {
            return 1
          }

          set value(next) {
            this.stored = next
          }
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "first", before: "value" } } ]
    },
    {
      code: dedent`
        class C {
          get value() {
            return 1
          }

          set value(next) {
            this.stored = next
          }

          first() {
            this.value = 2
          }
        }
      `,
      output: dedent`
        class C {
          first() {
            this.value = 2
          }

          get value() {
            return 1
          }

          set value(next) {
            this.stored = next
          }
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "first", before: "value" } } ]
    },
    {
      code: dedent`
        class C {
          connectedCallback() {
            this.close()
          }

          formResetCallback() {
            this.close()
          }

          close() {}
        }
      `,
      output: dedent`
        class C {
          connectedCallback() {
            this.close()
          }

          close() {}

          formResetCallback() {
            this.close()
          }
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "close", before: "formResetCallback" } } ]
    },
    {
      code: dedent`
        class C {
          connectedCallback() {
            this.open()
          }

          close() {}

          open() {}
        }
      `,
      options: [ { nameGroups: [ "Callback$" ] } ],
      output: dedent`
        class C {
          connectedCallback() {
            this.open()
          }

          open() {}

          close() {}
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "open", before: "close" } } ]
    }
  ]
})
