import rule from "#rules/boolean-naming"
import { dedent, tester } from "#test/support"

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
    "class C { isValid = () => this.x === 1 }",
    // Custom-element getter reflecting an attribute keeps the attribute name.
    "class FooElement extends HTMLElement { get disabled() { return this.hasAttribute(\"disabled\") } }",
    "class FooElement extends HTMLElement { get expanded() { return this.getAttribute(\"x\") === \"y\" } }",
    // Through an intermediate `Element` base class.
    "class FooElement extends BaseElement { get open() { return this.hasAttribute(\"open\") } }",
    // A call resolving to a non-boolean same-class method keeps a value name.
    "class C { get total() { return this.sum() } sum() { return this.a + this.b } }",
    // A call to a same-file non-boolean function keeps a value name.
    dedent`
      function size() { return list.length }
      class C { get count() { return size() } }
    `
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
    },
    {
      // Attribute read outside a custom element is not exempt.
      code: "class C extends Controller { get expanded() { return this.getAttribute(\"x\") === \"y\" } }",
      errors: [ { messageId: "booleanName", data: { name: "expanded", pascal: "Expanded" } } ]
    },
    {
      // The exemption is for getters only, not methods.
      code: "class FooElement extends HTMLElement { disabled() { return this.hasAttribute(\"disabled\") } }",
      errors: [ { messageId: "booleanName", data: { name: "disabled", pascal: "Disabled" } } ]
    },
    {
      // A boolean getter in a custom element that does not read an attribute still applies.
      code: "class FooElement extends HTMLElement { get empty() { return this.children.length === 0 } }",
      errors: [ { messageId: "booleanName", data: { name: "empty", pascal: "Empty" } } ]
    },
    {
      // Transitive: a getter returning a same-class boolean method is boolean.
      code: "class C { get ready() { return this.matchesInput() } matchesInput() { return this.x === 1 } }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      // Transitive: a getter returning a same-file boolean function is boolean.
      code: dedent`
        function matchesState() { return state === "on" }
        class C { get active() { return matchesState() } }
      `,
      errors: [ { messageId: "booleanName", data: { name: "active", pascal: "Active" } } ]
    }
  ]
})
