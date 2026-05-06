import rule from "#rules/declarative_method_naming"
import { dedent, tester } from "#support"

tester.run("declarative-method-naming", rule, {
  valid: [
    "class C { buildValue() { return this[key]() } }",
    // Asking a collaborator it just built gives no view of what happens inside, so the verb stays.
    "class C { buildComment(card) { return new Commenter(card).comment } }",
    "class C { buildComment() { return (() => new Commenter().comment)() } }",
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
    "class C { formatMoney(value) { return (() => this.format(value))() } format(value) { return String(value) } }",
    "class C { computeTotal() { this.total++; return this.total } }",
    "class C { get total() { return this.a + this.b } }",
    "class C { count() { return this.items.length } }",
    "class C { name() { return this.label } }",
    "class C { load() { this.trigger() } }",
    "class C { get() { return this.value } }",
    "class C { #build() { return new Scope(this.node) } }",
    "class Local { constructor() { outer++ } } class C { buildValue() { return new Local() } }",
    "class Local { value = outer++ } class C { buildValue() { return new Local() } }",
    "class Local extends External {} class C { buildValue() { return new Local() } }",
    "class Local { constructor(input) { this.run = input; this.run() } run() {} } "
    + "class C { buildValue(input) { return new Local(input) } }",
    "class Base { buildValue() { return this.read() } read() { return 1 } } "
    + "class Child extends Base { read() { outer++; return 1 } }",
    "export class Base { buildValue() { return this.read() } read() { return 1 } }",
    "class Base { buildValue() { return this.read() } read() { return 1 } } consume(Base)",
    "class C { #computeTotal() { this.total = this.a + this.b; return this.total } }",
    "class C { #collectInto(target) { target.push(this.value); return target } }",
    "class C { buildCache() { delete this.cache; return this.cache } }",
    "class C { buildCache(source) { ({ value: this.cache } = source); return this.cache } }",
    "class C { buildKeys(source) { for (this.key in source) use(this.key); return this.keys } }",
    "class C { buildItems(source) { for (this.item of source) use(this.item); return this.items } }",
    "class C { buildValue(value = (store.value = 1)) { return value } }",
    "class C { buildValue() { return (() => { store.value = 1; return store.value })() } }",
    "class C { buildValue() { return transform(value, () => { store.value = 1 }) } }",
    "class C { buildList() { return this.#fill() } #fill() { this.items.push(1); return this.items } }",
    "class C { buildList() { return (() => this.#fill())() }"
    + " #fill() { this.items.push(1); return this.items } }",
    "class C { buildList() { return this.#left() } #left() { return this.#right() } "
    + "#right() { this.items.push(1); return this.#left() } }",
    "class C { buildReport() { return collect() } } function collect() { store.push(1); return store }",
    "class C { buildType() { return class Inner { [store.value = 1]() {} } } }",
    "class C { buildType() { return class extends (store.value = Base) {} } }",
    "class C { buildType() { return class Inner { static value = (store.value = 1) } } }",
    "class C { buildType() { return class Inner { static { store.value = 1 } } } }",
    "class C { parseConfig(text) { return JSON.parse(text) } }",
    "function define(JSON) { return class C { parseConfig() { return JSON.parse('{}') } } }",
    "JSON.parse = custom; class C { parseConfig() { return JSON.parse('{}') } }",
    "JSON.parse = custom; const parse = JSON.parse; class C { parseConfig() { return parse('{}') } }",
    "class C { parseConfig() { return JSON.parse('{}') } } JSON.parse = custom",
    "let parse = JSON.parse; parse = custom; class C { parseConfig() { return parse('{}') } }",
    "class C { parseConfig() { return JSON.parse('{}', reviver) } }",
    "class C { parseConfig(parts) { return JSON.parse(...parts) } }",
    "class C { parseConfig(value) { return JSON.parse(`$" + "{value}`) } }",
    "class C { parseConfig() { return JSON.parse(void effect()) } }",
    "class C { #findInScope() { return this.scope.lookup() } }",
    "const prices = 'prices'; class C { get [prices]() { return this.values } buildPrices() { return [ 1, 2 ] } }",
    "const format = 'format'; class C { formatMoney(value) { return this[format](value) } "
    + "[format](value) { return String(value) } }",
    "class C { get #prices() { return this.values } #buildPrices() { return [ 1, 2 ] } }",
    // An anonymous default export has no name to index, and resolving past it must not crash.
    "export default function () { return 1 } class C { buildReport() { return collect() } }"
    + " function collect() { store.push(1); return store }",
    // `computed` is an adjective, not the verb `compute`.
    "class C { get computedTotal() { return this.x } }",
    "class C { toJSON() { return { a: 1 } } }",
    "class C { isReady() { return this.ready } }",
    "class C { buildScope() { items.forEach(() => { return make(it) }) } }",
    "class C { buildList() { return this.items[\"push\"](this.value) } }",
    "class C { total = () => this.a + this.b }",
    "const values = { total() { return 1 } }; consume(values); "
    + "class C { computeTotal() { return values.total() } }",
    "const Object = { is(left, right) { state++; return left === right } }; "
    + "class C { computeMatch(left, right) { return Object.is(left, right) } }",
    "Object.is = replacement; class C { computeMatch(left, right) { return Object.is(left, right) } }",
    "class C { computeMatch(values) { return Object.is(...values) } }",
    "class C { buildValue(iterable) { for (const value of iterable) void value; return 1 } }",
    "class C { buildValue(iterable) { const [ value ] = iterable; return value } }",
    "class C { buildValue(iterable) { return local(...iterable) } } function local() { return 1 }",
    "class C { buildValue(source) { return { ...source } } }",
    "class C { buildValue(tag) { return tag`value` } }",
    "class C { buildValue(resource) { using value = resource; return value } }",
    "function getUser(id) { return users[id] }",
    "export function calculateTax(amount) { return amount * rate }",
    "function findInScope() { return scope.lookup() }"
  ],
  invalid: [
    {
      code: "(() => {})(); class C { buildValue() { return this.value } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildValue", verb: "build", suggestion: "value" } } ]
    },
    {
      code: "if (false) { class C { buildValue() { return this.value } } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildValue", verb: "build", suggestion: "value" } } ]
    },
    {
      code: "class C { findInScope() { return this.value } }",
      errors: [ { messageId: "imperativeNameBare", data: { name: "findInScope", verb: "find" } } ]
    },
    {
      code: "class C { computeValue() { let total = 0; function add() { total++ }; add(); return total } }",
      errors: [ { messageId: "imperativeName", data: { name: "computeValue", verb: "compute", suggestion: "value" } } ]
    },
    {
      code: "const key = 'computeTotal'; class C { [key]() { return this.a + this.b } }",
      errors: [ { messageId: "imperativeName", data: { name: "computeTotal", verb: "compute", suggestion: "total" } } ]
    },
    {
      code: "class C { buildHandler() { return () => { this.value = 1 } } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildHandler", suggestion: "handler", verb: "build" } } ]
    },
    {
      code: "class C { buildHandler() { function isHandler() { store.push(1) }; return isHandler } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildHandler", suggestion: "handler", verb: "build" } } ]
    },
    {
      code: "class C { buildType() { return class Inner { value = (store.value = 1) } } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildType", suggestion: "type", verb: "build" } } ]
    },
    {
      code: "class C { buildType() { return class Inner { run() { store.value = 1 } } } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildType", suggestion: "type", verb: "build" } } ]
    },
    {
      code: "class C { get computeTotal() { return 1 } }",
      errors: [ { messageId: "imperativeName", data: { name: "computeTotal", suggestion: "total", verb: "compute" } } ]
    },
    {
      code: "class C { computeTotal() { return this.a + this.b } }",
      errors: [ { messageId: "imperativeName", data: { name: "computeTotal", verb: "compute", suggestion: "total" } } ]
    },
    {
      name: "retains a declarative-name report for an exact object spread",
      code: "class C { buildValue() { return { ...{ value: 1 } } } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildValue", verb: "build", suggestion: "value" } } ]
    },
    {
      name: "recognizes a coercion-free standard call",
      code: "class C { computeMatch(left, right) { return Object.is(left, right) } }",
      errors: [ { messageId: "imperativeNameRelate", data: { name: "computeMatch", verb: "compute" } } ]
    },
    {
      name: "recognizes a stable alias of a coercion-free standard call",
      code: "const same = Object.is; class C { computeMatch(left, right) { return same(left, right) } }",
      errors: [ { messageId: "imperativeNameRelate", data: { name: "computeMatch", verb: "compute" } } ]
    },
    {
      name: "recognizes JSON.parse when coercion and reviver dispatch are impossible",
      code: "class C { parseConfig() { return JSON.parse('{}') } }",
      errors: [ { messageId: "imperativeName", data: { name: "parseConfig", verb: "parse", suggestion: "config" } } ]
    },
    {
      name: "recognizes JSON.parse through a stable primitive alias",
      code: "const source = '{}'; class C { parseConfig() { return JSON.parse(source) } }",
      errors: [ { messageId: "imperativeName", data: { name: "parseConfig", verb: "parse", suggestion: "config" } } ]
    },
    {
      name: "recognizes JSON.parse with a constant template",
      code: "class C { parseConfig() { return JSON.parse(`{}`) } }",
      errors: [ { messageId: "imperativeName", data: { name: "parseConfig", verb: "parse", suggestion: "config" } } ]
    },
    {
      name: "does not mistake a stable JSON.parse alias for an owned verb family",
      code: "const parse = JSON.parse; class C { parseConfig() { return parse('{}') } }",
      errors: [ { messageId: "imperativeName", data: { name: "parseConfig", verb: "parse", suggestion: "config" } } ]
    },
    {
      name: "recognizes a destructured JSON.parse alias",
      code: "const { parse } = JSON; class C { parseConfig() { return parse('{}') } }",
      errors: [ { messageId: "imperativeName", data: { name: "parseConfig", verb: "parse", suggestion: "config" } } ]
    },
    {
      name: "keeps an intrinsic JSON.parse alias captured before replacement",
      code: "const parse = JSON.parse; JSON.parse = custom; class C { parseConfig() { return parse('{}') } }",
      errors: [ { messageId: "imperativeName", data: { name: "parseConfig", verb: "parse", suggestion: "config" } } ]
    },
    {
      name: "follows a confined local object method",
      code: "const values = { total() { return 1 } }; "
        + "class C { computeTotal() { return values.total() } }",
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
      code: "class Local {} class C { buildValue() { return new Local() } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildValue", verb: "build", suggestion: "value" } } ]
    },
    {
      code: "class Local { constructor() { this.value = 1 } } class C { buildValue() { return new Local() } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildValue", verb: "build", suggestion: "value" } } ]
    },
    {
      code: "class Local { value = 1 } class C { buildValue() { return new Local() } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildValue", verb: "build", suggestion: "value" } } ]
    },
    {
      code: "class Base {} class Local extends Base { constructor() { super(); this.value = 1 } } "
        + "class C { buildValue() { return new Local() } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildValue", verb: "build", suggestion: "value" } } ]
    },
    {
      code: "class Local {} const Alias = Local; class C { buildValue() { return new Alias() } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildValue", verb: "build", suggestion: "value" } } ]
    },
    {
      code: "class C { buildValue() { return new (class {})() } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildValue", verb: "build", suggestion: "value" } } ]
    },
    {
      code: "class Base {} class Local extends Base {} class C { buildValue() { return new Local() } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildValue", verb: "build", suggestion: "value" } } ]
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
      name: "does not inherit collaborator facts from a deferred function",
      code: "class C { buildComment() { function later() { return new Commenter().comment }; return later } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildComment", verb: "build", suggestion: "comment" } } ]
    },
    {
      name: "ignores calls after an abrupt completion",
      code: "class C { computeTotal() { return this.a + this.b; computePart() } }",
      errors: [ { messageId: "imperativeName", data: { name: "computeTotal", verb: "compute", suggestion: "total" } } ]
    },
    {
      name: "does not inherit a verb family from a nested deferred function",
      code: "class C { computeTotal() { function later() { computePart() }; return this.a + this.b } }",
      errors: [ { messageId: "imperativeName", data: { name: "computeTotal", verb: "compute", suggestion: "total" } } ]
    },
    {
      name: "does not assume a callback argument is invoked",
      code: "function remember(callback) { return value } "
        + "class C { computeTotal() { return remember(() => computePart()) } }",
      errors: [ { messageId: "imperativeName", data: { name: "computeTotal", verb: "compute", suggestion: "total" } } ]
    },
    {
      name: "separates static and instance sibling names",
      code: "class C { get prices() { return this.values } static buildPrices() { return [ 1, 2 ] } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildPrices", verb: "build", suggestion: "prices" } } ]
    },
    {
      name: "separates public and private sibling names",
      code: "class C { get prices() { return this.values } #buildPrices() { return [ 1, 2 ] } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildPrices", verb: "build", suggestion: "prices" } } ]
    },
    {
      name: "does not confuse a public hash-prefixed name with a private sibling",
      code: "class C { get ['#prices']() { return this.values } #buildPrices() { return [ 1, 2 ] } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildPrices", verb: "build", suggestion: "prices" } } ]
    },
    {
      name: "ignores an unresolved computed sibling name",
      code: "class C { [dynamic]() {} computeTotal() { return 1 } }",
      errors: [ { messageId: "imperativeName", data: { name: "computeTotal", verb: "compute", suggestion: "total" } } ]
    },
    {
      code: "class C { computeTotal = () => this.a + this.b }",
      errors: [ { messageId: "imperativeName", data: { name: "computeTotal", verb: "compute", suggestion: "total" } } ]
    },
    {
      code: "class C { buildName() { return this.#joined() } #joined() { return this.a + this.b } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildName", verb: "build", suggestion: "name" } } ]
    },
    {
      code: "class C { buildValue() { return this.#push() } #push() { return this.value } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildValue", verb: "build", suggestion: "value" } } ]
    },
    {
      code: "class C { buildName() { return this.#left() } #left() { return this.#right() } "
        + "#right() { return this.#left() } }",
      errors: [ { messageId: "imperativeName", data: { name: "buildName", verb: "build", suggestion: "name" } } ]
    },
    {
      name: "a shared pure call DAG is analyzed once per function",
      code: sharedCallDagOf(16),
      errors: [ { messageId: "imperativeName", data: { name: "computeValue", verb: "compute", suggestion: "value" } } ]
    },
    {
      name: "class member names are indexed once across many producers",
      code: independentProducers(1_000),
      errors: 1_000
    },
    { name: "nested producer bodies are indexed once", code: nestedProducers(300), errors: 300 },
    {
      name: "a deep pure call chain does not consume the call stack",
      code: pureCallChainOf(3_000),
      errors: [ { messageId: "imperativeName", data: { name: "computeValue", verb: "compute", suggestion: "value" } } ]
    }
  ]
})

function sharedCallDagOf(depth) {
  const methods = [ "computeValue() { return this.#a0() + this.#b0() }" ]
  for (let index = 0; index < depth; index += 1) {
    methods.push(
      `#a${index}() { return this.#a${index + 1}() + this.#b${index + 1}() }`,
      `#b${index}() { return this.#a${index + 1}() + this.#b${index + 1}() }`
    )
  }
  methods.push(`#a${depth}() { return 1 }`, `#b${depth}() { return 2 }`)
  return `class Subject { ${methods.join("\n")} }`
}

function independentProducers(count) {
  return `class Subject { ${Array.from({ length: count }, producerAt).join("\n")} }`
}

function producerAt(_, index) {
  return `computeValue${index}() { return ${index} }`
}

function nestedProducers(count) {
  return Array.from({ length: count }, (_, index) => count - index - 1).reduce(
    (body, index) => `class Subject${index} { computeValue${index}() { ${body}; return ${index} } }`,
    ""
  )
}

function pureCallChainOf(count) {
  const methods = Array.from({ length: count }, (_, index) => `#m${index}() { return this.#m${index + 1}() }`)
  methods.unshift("computeValue() { return this.#m0() }")
  methods.push(`#m${count}() { return 1 }`)
  return `class Subject { ${methods.join("\n")} }`
}
