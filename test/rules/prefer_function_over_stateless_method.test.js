import rule from "#rules/prefer_function_over_stateless_method"
import { dedent, nestedPrivateMethods, tester } from "#support"

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
    `,
    dedent`
      class C {
        #value = 1
        #equals(other) { return other.#value === 1 }
      }
    `,
    dedent`
      class C {
        static #value = 1
        static #valueFromClass() { return C.#value }
      }
    `,
    dedent`
      class C {
        #valueFromDefault(value = this.value) { return value }
        #deferred() { return () => this.value }
      }
    `,
    dedent`
      class C {
        #nested() {
          return class Nested extends this.Base { [this.key]() {} }
        }
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
    },
    {
      code: dedent`
        class C {
          #type() { return class Nested { #value; read() { return this.#value } } }
        }
      `,
      errors: [ { messageId: "statelessMethod", data: { name: "#type" } } ]
    },
    { name: "indexes deeply nested stateless methods once", code: nestedPrivateMethods(400), errors: 400 }
  ]
})
