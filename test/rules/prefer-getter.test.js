import rule from "#rules/prefer-getter"
import { tester } from "#support"

tester.run("prefer-getter", rule, {
  valid: [
    // Takes a parameter.
    "class C { scaled(factor) { return factor * 2 } }",
    // More than a single return statement.
    "class C { total() { const base = 1; return base } }",
    // Async cannot be a getter.
    "class C { async data() { return 1 } }",
    // Returns an action (assignment), not a computed value.
    "class C { toggle() { return this.open = true } }",
    // Returns `this` for chaining.
    "class C { reset() { return this } }",
    // Returns a function, not a value.
    "class C { handler() { return () => this.run() } }",
    // Conventional method names stay methods.
    "class C { toString() { return this.label } }",
    "class C { get size() { return this.items.length } }"
  ],
  invalid: [
    {
      code: "class C { size() { return this.items.length } }",
      errors: [ { messageId: "preferGetter", data: { name: "size" } } ]
    },
    {
      code: "class C { #names() { return this.list.map((item) => item.name) } }",
      errors: [ { messageId: "preferGetter", data: { name: "#names" } } ]
    }
  ]
})
