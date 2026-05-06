import rule from "#rules/step-down-methods"
import { dedent, tester } from "#test/support"

tester.run("step-down-methods", rule, {
  valid: [
    // Two members sharing a name would collapse into one and the other would be
    // dropped, so the group is left alone.
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
    // Getters form their own group, ordered independently of methods.
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
    // Static getters are their own group too: a caller before its callee.
    dedent`
      class C {
        static get primary() {
          return this.secondary
        }

        static get secondary() {
          return true
        }
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
    // Static getters reorder within their own group, independent of instance getters.
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
    }
  ]
})
