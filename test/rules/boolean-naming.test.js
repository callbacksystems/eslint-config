import rule from "#rules/boolean-naming"
import { tester } from "#test/support"

tester.run("boolean-naming", rule, {
  valid: [
    // State predicates use the is-prefix.
    "class C { get isValid() { return this.x === 1 } }",
    "function isReady() { return state === \"ready\" }",
    // Third-person verb predicates for actions/relations.
    "class C { forwardsAll() { return this.items.every(Boolean) } }",
    "class C { has(key) { return this.set.has(key) } }",
    // Non-boolean members keep value names.
    "class C { get name() { return this.value } }",
    "class C { count() { return this.items.length } }",
    // Arrow-field predicates follow the same naming.
    "class C { isValid = () => this.x === 1 }"
  ],
  invalid: [
    {
      code: "class C { get redundant() { return this.a === this.b } }",
      errors: [ { messageId: "booleanName", data: { name: "redundant", pascal: "Redundant" } } ]
    },
    {
      code: "class C { empty() { return this.items.length === 0 } }",
      errors: [ { messageId: "booleanName", data: { name: "empty", pascal: "Empty" } } ]
    },
    {
      code: "function ready() { return Boolean(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "class C { closed() { return !this.open } }",
      errors: [ { messageId: "booleanName", data: { name: "closed", pascal: "Closed" } } ]
    },
    {
      // Boolean-returning arrow field with an expression body.
      code: "class C { valid = () => this.a === this.b }",
      errors: [ { messageId: "booleanName", data: { name: "valid", pascal: "Valid" } } ]
    }
  ]
})
