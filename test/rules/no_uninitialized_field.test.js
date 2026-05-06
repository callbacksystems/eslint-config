import rule from "#rules/no_uninitialized_field"
import { dedent, tester } from "#support"

tester.run("no-uninitialized-field", rule, {
  valid: [
    "class C { count = 0 }",
    "class C { static targets = [] }",
    "class C { #cache = new Map() }",
    // A private field needs its declaration: `this.#node` is a syntax error without it.
    "class C { #node }",
    "class C { static #instances }",
    // The assignment creates the property, no declaration needed.
    dedent`
      class C {
        constructor(node) {
          this.node = node
        }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        class C {
          observer

          connect() {
            this.observer = new Observer()
          }
        }
      `,
      output: dedent`
        class C {
          connect() {
            this.observer = new Observer()
          }
        }
      `,
      errors: [ { messageId: "uninitializedField", data: { name: "observer" } } ]
    },
    {
      code: dedent`
        class C {
          count = 0
          total
          label = ""
        }
      `,
      output: dedent`
        class C {
          count = 0
          label = ""
        }
      `,
      errors: [ { messageId: "uninitializedField", data: { name: "total" } } ]
    },
    {
      code: "class C { static registry }",
      output: "class C { }",
      errors: [ { messageId: "uninitializedField", data: { name: "registry" } } ]
    },
    // A comment written under the field explains what comes next, so the removal stops at it.
    {
      code: dedent`
        class C {
          channel
          // Opens on connect.
          open() {
            this.channel = subscribe()
          }
        }
      `,
      output: dedent`
        class C {
          // Opens on connect.
          open() {
            this.channel = subscribe()
          }
        }
      `,
      errors: [ { messageId: "uninitializedField", data: { name: "channel" } } ]
    }
  ]
})
