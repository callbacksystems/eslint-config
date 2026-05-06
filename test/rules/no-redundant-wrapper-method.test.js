import rule from "#rules/no-redundant-wrapper-method"
import { tester } from "#test/support"

tester.run("no-redundant-wrapper-method", rule, {
  valid: [
    // Public method may be API.
    "class C { findAll() { return find(this.node) } }",
    // Predicate may be a semantic alias.
    "class C { #hasItems() { return check(this.node) } }",
    // Transforms the result, not a bare forward.
    "class C { #names() { return collect(this.node).map((item) => item.name) } }",
    // Argument is computed, not passed through.
    "class C { #wrap() { return other(compute()) } }",
    // Getter forwarding to a non-local function is a thin accessor of a shared util.
    "class C { get #thing() { return build(this.a, this.b) } }",
    // Public getter is part of the interface.
    "function build(a, b) { return a } class C { get thing() { return build(this.a, this.b) } }"
  ],
  invalid: [
    {
      code: "class C { #findAll() { return find(this.node) } }",
      errors: [ { messageId: "redundantWrapper", data: { name: "#findAll" } } ]
    },
    {
      code: "class C { #helper(value) { return process(value) } }",
      errors: [ { messageId: "redundantWrapper", data: { name: "#helper" } } ]
    },
    {
      // Getter forwarding the class's own fields to a module-local function: that
      // function should be a method of this class, not a free function.
      code: "function build(a, b) { return a } class C { get #thing() { return build(this.a, this.b) } }",
      errors: [ { messageId: "redundantWrapper", data: { name: "#thing" } } ]
    }
  ]
})
