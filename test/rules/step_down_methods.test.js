import rule from "#rules/step_down_methods"
import { dedent, tester } from "#support"

tester.run("step-down-methods", rule, {
  valid: [
    // With `separateAccessors`, a getter no longer moves in among the methods that reach it.
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
    // Name-grouped members are never reordered among themselves: the rule that drew the group owns their order.
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
    // A helper shared by two members of different name groups stays put.
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
    // Two members sharing a name would collapse into one and the other would be dropped, so the group is left alone.
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
    // Caller before its callees, across the public/private boundary.
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
    // Independent public methods keep their source order (no alphabetizing).
    dedent`
      class C {
        zebra() {}
        apple() {}
      }
    `,
    // A single method per group: nothing to order.
    dedent`
      class C {
        only() {
          this.#helper()
        }

        #helper() {}
      }
    `,
    // A getter orders with the methods around it, so the method reaching it comes first.
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
    // Static members read top-down among themselves: a caller before its callee.
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
    // An accessor pair already sitting where its first use puts it.
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
    // A trailing comment explains its own method and travels with it.
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
    // A private helper defined before the helper that calls it.
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
    // The constructor's first call decides which private helper leads.
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
    // Static members reorder within their own group, independent of the instance ones.
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
    // A getter defined before the method that reaches it.
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
    // The setter travels with its getter to where the pair is first used.
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
    // A setter separated from its getter joins it, and the pair follows the first use.
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
    // Writing through the setter counts as the first use.
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
    // The same file without name groups: the helper is asked to move between the two callbacks.
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
    // A name-grouped member still seeds the order of what it reaches.
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
