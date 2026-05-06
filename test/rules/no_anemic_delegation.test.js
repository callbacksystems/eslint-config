import rule from "#rules/no_anemic_delegation"
import { tester } from "#support"

tester.run("no-anemic-delegation", rule, {
  valid: [
    // Public method may be API.
    "class C { findAll(body) { return new ScopeBody(body).findAll() } }",
    // Predicate may be a semantic alias.
    "class C { #isValid(body) { return new Validator(body).isValid() } }",
    // Built from own state, not a pass-through of parameters.
    "class C { #scope() { return new ScopeBody(this.node).scope() } }",
    // Constructor argument is computed, not passed straight through.
    "class C { #wrap(body) { return new ScopeBody(parse(body)).run() } }",
    // Factory: returns the instance, does not delegate to it.
    "class C { #build(body) { return new ScopeBody(body) } }",
    // Transforms the delegated result, not a bare forward.
    "class C { #names(body) { return new ScopeBody(body).names().filter(Boolean) } }",
    // Exported function is public API, even when it only delegates.
    "export function findAll(body) { return new ScopeBody(body).findAll() }",
    // Free function that builds from computed values, not a pass-through.
    "function wrap(body) { return new ScopeBody(parse(body)).run() }"
  ],
  invalid: [
    {
      code: "class C { #eagerLoading(body) { return new ScopeBody(body).eagerLoading() } }",
      errors: [ { messageId: "anemicDelegation", data: { name: "#eagerLoading", className: "ScopeBody" } } ]
    },
    {
      code: "class C { #scope(body) { return new ScopeBody(body).scope } }",
      errors: [ { messageId: "anemicDelegation", data: { name: "#scope", className: "ScopeBody" } } ]
    },
    {
      code: "class C { #fresh() { return new Builder().fresh() } }",
      errors: [ { messageId: "anemicDelegation", data: { name: "#fresh", className: "Builder" } } ]
    },
    {
      // Free function forwarding to a member of a freshly built object.
      code: "function isRelated(statement) { return new MemoizationStatement(statement).isRelated }",
      errors: [ { messageId: "anemicDelegation", data: { name: "isRelated", className: "MemoizationStatement" } } ]
    },
    {
      // Free predicate function is callback plumbing, not exempt like a method predicate.
      code: "function isValid(body) { return new Validator(body).isValid() }",
      errors: [ { messageId: "anemicDelegation", data: { name: "isValid", className: "Validator" } } ]
    }
  ]
})
