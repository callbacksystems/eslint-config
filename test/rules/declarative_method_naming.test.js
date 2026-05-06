import rule from "#rules/declarative_method_naming"
import { dedent, tester } from "#support"

tester.run("declarative-method-naming", rule, {
  valid: [
    // Asking a collaborator it just built gives no view of what happens inside, so the verb stays.
    "class C { buildComment(card) { return new Commenter(card).comment } }",
    // Mirrors an operation of its own verb family, which renaming would break.
    dedent`
      class C {
        formatMoney(value) {
          return this.format(value)
        }

        format(value) {
          return String(value)
        }
      }
    `,
    // The value already carries the declarative name next door, so the suggestion is taken.
    dedent`
      class C {
        get prices() {
          return this.buildPrices()
        }

        buildPrices() {
          return [ 1, 2 ]
        }
      }
    `,
    // The family may live in a module function too.
    "class C { formatMoney(value) { return formatShort(value) } }",
    "class C { computeTotal() { this.total++; return this.total } }",
    "class C { get total() { return this.a + this.b } }",
    "class C { count() { return this.items.length } }",
    "class C { name() { return this.label } }",
    "class C { load() { this.trigger() } }",
    "class C { get() { return this.value } }",
    "class C { #build() { return new Scope(this.node) } }",
    "class C { #computeTotal() { this.total = this.a + this.b; return this.total } }",
    "class C { #collectInto(target) { target.push(this.value); return target } }",
    "class C { buildList() { return this.#fill() } #fill() { this.items.push(1); return this.items } }",
    "class C { buildReport() { return collect() } } function collect() { store.push(1); return store }",
    // An anonymous default export has no name to index, and resolving past it must not crash.
    "export default function () { return 1 } class C { buildReport() { return collect() } }"
    + " function collect() { store.push(1); return store }",
    // `computed` is an adjective, not the verb `compute`.
    "class C { get computedTotal() { return this.x } }",
    "class C { toJSON() { return { a: 1 } } }",
    "class C { isReady() { return this.ready } }",
    "class C { buildScope() { items.forEach(() => { return make(it) }) } }",
    "class C { total = () => this.a + this.b }",
    "function getUser(id) { return users[id] }",
    "export function calculateTax(amount) { return amount * rate }",
    "function findInScope() { return scope.lookup() }"
  ],
  invalid: [
    {
      code: "class C { get computeTotal() { return 1 } }",
      errors: [ { messageId: "imperativeName", data: { name: "computeTotal", suggestion: "total", verb: "compute" } } ]
    },
    {
      code: "class C { computeTotal() { return this.a + this.b } }",
      errors: [ { messageId: "imperativeName", data: { name: "computeTotal", verb: "compute", suggestion: "total" } } ]
    },
    {
      code: "class C { getUser(id) { return this.users[id] } }",
      errors: [ { messageId: "imperativeNameRelate", data: { name: "getUser", verb: "get" } } ]
    },
    {
      code: "class C { #deriveScope() { return new Scope(this.node) } }",
      errors: [ { messageId: "imperativeName", data: { name: "deriveScope", verb: "derive", suggestion: "scope" } } ]
    },
    {
      // The tagger reads `parse` as a noun, so the curated verb list has to catch it.
      code: "class C { parseConfig(text) { return JSON.parse(text) } }",
      errors: [ { messageId: "imperativeNameRelate", data: { name: "parseConfig", verb: "parse" } } ]
    },
    {
      code: "class C { #extractTitle() { return this.node.title } }",
      errors: [ { messageId: "imperativeName", data: { name: "extractTitle", verb: "extract", suggestion: "title" } } ]
    },
    {
      code: "class C { get fetchData() { return this.data } }",
      errors: [ { messageId: "imperativeName", data: { name: "fetchData", verb: "fetch", suggestion: "data" } } ]
    },
    {
      code: "class C { getUserById(id) { return this.users[id] } }",
      errors: [ { messageId: "imperativeName", data: { name: "getUserById", verb: "get", suggestion: "userById" } } ]
    },
    {
      code: "class C { #findInScope() { return this.scope.lookup() } }",
      errors: [ { messageId: "imperativeNameBare", data: { name: "findInScope", verb: "find" } } ]
    },
    {
      code: "class C { computeTotal = () => this.a + this.b }",
      errors: [ { messageId: "imperativeName", data: { name: "computeTotal", verb: "compute", suggestion: "total" } } ]
    },
    {
      code: "class C { buildName() { return this.#joined() } #joined() { return this.a + this.b } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildName", verb: "build", suggestion: "name" } } ]
    }
  ]
})
