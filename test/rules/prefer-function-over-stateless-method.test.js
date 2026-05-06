import rule from "#rules/prefer-function-over-stateless-method"
import { dedent, tester } from "#support"

tester.run("prefer-function-over-stateless-method", rule, {
  valid: [
    // Uses instance state, so it belongs on the class.
    dedent`
      class C {
        #total() { return this.a + this.b }
      }
    `,
    // Reaches the class through `super`.
    dedent`
      class C extends B {
        #label() { return super.label }
      }
    `,
    // Calls another instance member.
    dedent`
      class C {
        #ready() { return this.#check() }
        #check() { return this.ok }
      }
    `,
    // Public methods are out of scope: may be an interface or polymorphic hook.
    dedent`
      class C {
        apply(x) { return x * 2 }
      }
    `,
    // A private field that is not a function is untouched.
    dedent`
      class C {
        #limit = 10
      }
    `,
    // The `this` inside a nested arrow still counts as instance use.
    dedent`
      class C {
        #ids() { return this.items.map(() => this.scope) }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        class C {
          #double(n) { return n * 2 }
        }
      `,
      errors: [ { messageId: "statelessMethod", data: { name: "#double" } } ]
    },
    {
      // Only delegates to module-level helpers, no instance state.
      code: dedent`
        class C {
          #mutation(node) { return isAssignment(node) || isCall(node) }
        }
      `,
      errors: [ { messageId: "statelessMethod", data: { name: "#mutation" } } ]
    },
    {
      // A nested regular function rebinds `this`, so the method itself uses none.
      code: dedent`
        class C {
          #run(items) { return items.map(function () { return this.x }) }
        }
      `,
      errors: [ { messageId: "statelessMethod", data: { name: "#run" } } ]
    }
  ]
})
