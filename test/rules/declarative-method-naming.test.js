import rule from "#rules/declarative-method-naming"
import { tester } from "#test/support"

tester.run("declarative-method-naming", rule, {
  valid: [
    // Declarative noun name for what it returns.
    "class C { get total() { return this.a + this.b } }",
    // Noun-verbs are left alone: they read as nouns naming the value.
    "class C { count() { return this.items.length } }",
    "class C { name() { return this.label } }",
    "function value() { return store.read() }",
    // Producer verb but no value returned: it is a command, not a query.
    "class C { load() { this.trigger() } }",
    "function compute() { sideEffect() }",
    // A name that is exactly the producer verb is allowed: with no noun there is
    // nothing to rename it to (`compute`, `fetch`, `get`, `#build`).
    "function compute() { return heavy() }",
    "function fetch() { return store.read() }",
    "class C { get() { return this.value } }",
    "class C { #build() { return new Scope(this.node) } }",
    // Returns a value but also changes state: it does something, so the verb stays.
    "class C { #computeTotal() { this.total = this.a + this.b; return this.total } }",
    "class C { #collectInto(target) { target.push(this.value); return target } }",
    // Adjective forms already read declaratively; the leading word is not the verb.
    "class C { get computedTotal() { return this.x } }",
    "function formattedName() { return format(this.name) }",
    // `to*` converters and predicates are owned by convention and other rules.
    "class C { toJSON() { return { a: 1 } } }",
    "class C { isReady() { return this.ready } }",
    // The only return lives in a nested function, so this body returns nothing.
    "function build() { items.forEach(() => { return make(it) }) }",
    // Arrow-field methods follow the same naming; no producer verb here.
    "class C { total = () => this.a + this.b }"
  ],
  invalid: [
    {
      code: "class C { computeTotal() { return this.a + this.b } }",
      errors: [ { messageId: "imperativeName", data: { name: "computeTotal", verb: "compute", suggestion: "total" } } ]
    },
    {
      // Has a parameter: only flag it; the relator (suffix or verb) is contextual.
      code: "function getUser(id) { return users[id] }",
      errors: [ { messageId: "imperativeNameRelate", data: { name: "getUser", verb: "get" } } ]
    },
    {
      code: "class C { #deriveScope() { return new Scope(this.node) } }",
      errors: [ { messageId: "imperativeName", data: { name: "deriveScope", verb: "derive", suggestion: "scope" } } ]
    },
    {
      // `parse` is a producer verb a tagger miscalls a noun; curation flags it.
      code: "function parseConfig(text) { return JSON.parse(text) }",
      errors: [ { messageId: "imperativeNameRelate", data: { name: "parseConfig", verb: "parse" } } ]
    },
    {
      // `extract` folds into this rule, no longer a separate one.
      code: "class C { #extractTitle() { return this.node.title } }",
      errors: [ { messageId: "imperativeName", data: { name: "extractTitle", verb: "extract", suggestion: "title" } } ]
    },
    {
      // A getter named for the action rather than the value.
      code: "class C { get fetchData() { return this.data } }",
      errors: [ { messageId: "imperativeName", data: { name: "fetchData", verb: "fetch", suggestion: "data" } } ]
    },
    {
      // Exported functions are not exempt: the name is wrong regardless of API status.
      code: "export function calculateTax(amount) { return amount * rate }",
      errors: [ { messageId: "imperativeNameRelate", data: { name: "calculateTax", verb: "calculate" } } ]
    },
    {
      // The noun already carries a connector; the bare noun is the suggestion.
      code: "function getUserById(id) { return users[id] }",
      errors: [ { messageId: "imperativeName", data: { name: "getUserById", verb: "get", suggestion: "userById" } } ]
    },
    {
      // Verb followed by a connector: stripping it leaves a phrase, so no suggestion.
      code: "function findInScope() { return scope.lookup() }",
      errors: [ { messageId: "imperativeNameBare", data: { name: "findInScope", verb: "find" } } ]
    },
    {
      // Producer-verb arrow field with an expression body.
      code: "class C { computeTotal = () => this.a + this.b }",
      errors: [ { messageId: "imperativeName", data: { name: "computeTotal", verb: "compute", suggestion: "total" } } ]
    }
  ]
})
