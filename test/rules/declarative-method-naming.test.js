import rule from "#rules/declarative-method-naming"
import { tester } from "#support"

tester.run("declarative-method-naming", rule, {
  valid: [
    // Declarative noun name for what it returns.
    "class C { get total() { return this.a + this.b } }",
    // Noun-verbs are left alone: they read as nouns naming the value.
    "class C { count() { return this.items.length } }",
    "class C { name() { return this.label } }",
    // Producer verb but no value returned: it is a command, not a query.
    "class C { load() { this.trigger() } }",
    // A name that is exactly the producer verb is allowed: with no noun there is nothing to rename it to (`get`,
    // `#build`).
    "class C { get() { return this.value } }",
    "class C { #build() { return new Scope(this.node) } }",
    // Returns a value but also changes state: it does something, so the verb stays.
    "class C { #computeTotal() { this.total = this.a + this.b; return this.total } }",
    "class C { #collectInto(target) { target.push(this.value); return target } }",
    // Transitive: delegates its work to a same-class mutator, so the verb stays.
    "class C { buildList() { return this.#fill() } #fill() { this.items.push(1); return this.items } }",
    // Transitive: delegates to a same-file function that mutates state.
    "class C { buildReport() { return collect() } } function collect() { store.push(1); return store }",
    // An anonymous default export has no name to index; resolving past it must not crash the run.
    "export default function () { return 1 } class C { buildReport() { return collect() } }"
    + " function collect() { store.push(1); return store }",
    // Adjective forms already read declaratively; the leading word is not the verb.
    "class C { get computedTotal() { return this.x } }",
    // `to*` converters and predicates are owned by convention and other rules.
    "class C { toJSON() { return { a: 1 } } }",
    "class C { isReady() { return this.ready } }",
    // The only return lives in a nested function, so this body returns nothing.
    "class C { buildScope() { items.forEach(() => { return make(it) }) } }",
    // Arrow-field methods follow the same naming; no producer verb here.
    "class C { total = () => this.a + this.b }",
    // Standalone functions are exempt, even with an imperative producer name and even when exported: a named function
    // reads as a unit of behavior.
    "function getUser(id) { return users[id] }",
    "export function calculateTax(amount) { return amount * rate }",
    "function findInScope() { return scope.lookup() }"
  ],
  invalid: [
    {
      code: "class C { computeTotal() { return this.a + this.b } }",
      errors: [ { messageId: "imperativeName", data: { name: "computeTotal", verb: "compute", suggestion: "total" } } ]
    },
    {
      // Has a parameter: only flag it; the relator (suffix or verb) is contextual.
      code: "class C { getUser(id) { return this.users[id] } }",
      errors: [ { messageId: "imperativeNameRelate", data: { name: "getUser", verb: "get" } } ]
    },
    {
      code: "class C { #deriveScope() { return new Scope(this.node) } }",
      errors: [ { messageId: "imperativeName", data: { name: "deriveScope", verb: "derive", suggestion: "scope" } } ]
    },
    {
      // `parse` is a producer verb a tagger miscalls a noun; curation flags it.
      code: "class C { parseConfig(text) { return JSON.parse(text) } }",
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
      // The noun already carries a connector; the bare noun is the suggestion.
      code: "class C { getUserById(id) { return this.users[id] } }",
      errors: [ { messageId: "imperativeName", data: { name: "getUserById", verb: "get", suggestion: "userById" } } ]
    },
    {
      // Verb followed by a connector: stripping it leaves a phrase, so no suggestion.
      code: "class C { #findInScope() { return this.scope.lookup() } }",
      errors: [ { messageId: "imperativeNameBare", data: { name: "findInScope", verb: "find" } } ]
    },
    {
      // Producer-verb arrow field with an expression body.
      code: "class C { computeTotal = () => this.a + this.b }",
      errors: [ { messageId: "imperativeName", data: { name: "computeTotal", verb: "compute", suggestion: "total" } } ]
    },
    {
      // Transitive: delegates only to a pure helper, so it still just delivers a value.
      code: "class C { buildName() { return this.#joined() } #joined() { return this.a + this.b } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildName", verb: "build", suggestion: "name" } } ]
    }
  ]
})
