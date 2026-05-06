import rule from "#rules/prefer_function_over_stateless_method"
import { dedent, tester } from "#support"

tester.run("prefer-function-over-stateless-method", rule, {
  valid: [
    dedent`
      class C {
        #total() { return this.a + this.b }
      }
    `,
    dedent`
      class C extends B {
        #label() { return super.label }
      }
    `,
    dedent`
      class C {
        #ready() { return this.#check() }
        #check() { return this.ok }
      }
    `,
    dedent`
      class C {
        apply(x) { return x * 2 }
      }
    `,
    dedent`
      class C {
        #limit = 10
      }
    `,
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
