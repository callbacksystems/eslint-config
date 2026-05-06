import rule from "#rules/no_anemic_delegation"
import { tester } from "#support"

tester.run("no-anemic-delegation", rule, {
  valid: [
    "class C { async #findAll(body) { return new ScopeBody(body).findAll() } }",
    "class C { *#findAll(body) { return new ScopeBody(body).findAll() } }",
    "class C { findAll(body) { return new ScopeBody(body).findAll() } }",
    // A predicate may be a semantic alias.
    "class C { #isValid(body) { return new Validator(body).isValid() } }",
    "class C { #includes(body) { return new Set(body).has(value) } }",
    "class C { #scope() { return new ScopeBody(this.node).scope() } }",
    "class C { #wrap(body) { return new ScopeBody(parse(body)).run() } }",
    "class C { #build(body) { return new ScopeBody(body) } }",
    "class C { #names(body) { return new ScopeBody(body).names().filter(Boolean) } }",
    "class C { #scope(body) { return new ScopeBody(body)[method]() } }",
    "export function findAll(body) { return new ScopeBody(body).findAll() }",
    "function findAll(body) { return new ScopeBody(body).findAll() } export { findAll as search }",
    "export default function (body) { return new ScopeBody(body).findAll() }",
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
      code: "class C { #scope(body) { return new ScopeBody(body)[\"scope\"]() } }",
      errors: [ { messageId: "anemicDelegation", data: { name: "#scope", className: "ScopeBody" } } ]
    },
    {
      code: "class C { #scope(body) { return new ScopeBody(body)[`scope`]() } }",
      errors: [ { messageId: "anemicDelegation", data: { name: "#scope", className: "ScopeBody" } } ]
    },
    {
      code: "class C { #fresh() { return new Builder().fresh() } }",
      errors: [ { messageId: "anemicDelegation", data: { name: "#fresh", className: "Builder" } } ]
    },
    {
      code: "class C { #users(id) { return new Scope(id).users() } }",
      errors: [ { messageId: "anemicDelegation", data: { name: "#users", className: "Scope" } } ]
    },
    {
      name: "does not infer a native predicate contract after its method is replaced",
      code: "Set.prototype.has = replacement; class C { #includes(body) { return new Set(body).has(value) } }",
      errors: [ { messageId: "anemicDelegation", data: { name: "#includes", className: "Set" } } ]
    },
    {
      name: "does not infer a native predicate contract from a shadowed constructor",
      code: "function build(Set) { class C { #includes(body) { return new Set(body).has(value) } } }",
      errors: [ { messageId: "anemicDelegation", data: { name: "#includes", className: "Set" } } ]
    },
    {
      code: "function isRelated(statement) { return new MemoizationStatement(statement).isRelated }",
      errors: [ { messageId: "anemicDelegation", data: { name: "isRelated", className: "MemoizationStatement" } } ]
    },
    {
      // A free predicate is callback plumbing, unlike a method predicate.
      code: "function isValid(body) { return new Validator(body).isValid() }",
      errors: [ { messageId: "anemicDelegation", data: { name: "isValid", className: "Validator" } } ]
    }
  ]
})
