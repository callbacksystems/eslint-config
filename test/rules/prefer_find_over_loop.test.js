import rule from "#rules/prefer_find_over_loop"
import { tester } from "#support"

tester.run("prefer-find-over-loop", rule, {
  valid: [
    "for (const x of items) use(x)",
    "for (const x of items) { if (x.skip) continue; use(x) }",
    "for (const x of items) { register(() => { if (x) return x }) }",
    // Returning the first element unconditionally is no search.
    "function f() { for (const x of items) { return x } }",
    // `for await` is left alone: `find`/`some` cannot await.
    "async function f() { for await (const x of items) { if (await ok(x)) return x } }",
    "async function f() { for (const x of items) { if (await ok(x)) return x } }",
    "function* f() { for (const x of items) { if (x.valid) return x } }",
    "function f() { for (const x of items) { if (x.valid) return transform(x) } }",
    "function f() { for (const x of items) { if (x.valid) return false } }",
    "function f() { for (const x of items) { const value = other; if (value.valid) return value } }",
    "function f(xs) { for (let x of xs) { x = transform(x); if (x.ok) return x } }",
    "function f(xs) { for (const x of xs) { if (stop(x)) break; if (x.ok) return x } }",
    "function f(xs) { outer: for (const x of xs) { if (stop(x)) break outer; if (x.ok) return x } }",
    "function f() { for (using x of items) { if (x.valid) return x } }",
    "async function f() { for (await using x of items) { if (x.valid) return x } }",
    "function f() { for (const x of new Set(items)) { if (x.valid) return x } }",
    "const NativeSet = Set; function f() { for (const x of new NativeSet(items)) { if (x.valid) return x } }",
    "let NativeSet = Set; function f() { for (const x of new NativeSet(items)) { if (x.valid) return x } }",
    "const NativeSet = Set; const Collection = NativeSet; "
    + "function f() { for (const x of new Collection(items)) { if (x.valid) return x } }",
    "function f() { const items = new Map(entries); for (const x of items) { if (x[1]) return x } }",
    "const source = new Set(items); function f() { for (const x of source) { if (x) return x } }",
    "const base = new Set(items); const source = base; "
    + "function f() { for (const x of source) { if (x) return x } }",
    "function f() { for (const x of \"items\") { if (x === \"i\") return x } }",
    "function* values() { yield 1 } function f() { for (const x of values()) { if (x) return x } }",
    "const values = function* () { yield 1 }; const source = values; "
    + "function f() { for (const x of source()) { if (x) return x } }",
    "class C { *values() { yield 1 } find() { for (const x of this.values()) { if (x) return x } } }",
    // An `if` surrounding a loop does not make the loop itself a conditional search.
    "function f() { if (ready) for (const x of items) return true }",
    // Nested functions own their await/return syntax, so neither event belongs to the loop.
    "async function f() { for (const x of items) register(async () => { if (x) { await save(); return x } }) }",
    // An await in a nested loop's body belongs to every enclosing loop in the same function.
    "async function f() { for (const x of xs) { for (const y of ys) { if (await ok(y)) return y } } }",
    "function f() { for (const [ key ] of items) { if (key) return key } }",
    "function f() { for (x of items) { if (x.valid) return x } }",
    { name: "indexes deeply nested loops once", code: `function f() { ${nestedLoopsAround("use()", 600)} }` },
    {
      name: "shares a resolved unsupported source across loops",
      code: "function f() { const source = new Set(items); "
        + "for (const x of source) { if (x) return x } for (const y of source) { if (y) return y } }"
    },
    "function f() { let source = new Set(items); for (const x of source) { if (x) return x } }",
    {
      name: "follows the value at the loop before a later reassignment",
      code: "function f() { let source = new Set(items); for (const x of source) { if (x) return x }; source = items }"
    },
    {
      name: "follows a deferred outer binding declared after the function",
      code: "function f() { for (const x of source) { if (x) return x } }; const source = new Set(items)"
    }
  ],
  invalid: [
    {
      name: "does not follow a collection initializer declared after its use",
      code: "function f() { for (const x of source) { if (x) return x }; const source = new Set(items) }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "does not follow a var initializer declared after its use",
      code: "function f() { for (const x of source) { if (x) return x }; var source = new Set(items) }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "does not follow a conditional var initializer",
      code: "function f(flag) { if (flag) var source = new Set(items); "
        + "for (const x of source) { if (x) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "does not follow an alias initialized before its dependency",
      code: "function f() { const first = second; const second = new Set(items); "
        + "for (const x of first) { if (x) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "a shadowed collection constructor remains conservatively searchable",
      code: "class Set extends Array {} function f() { for (const x of new Set(items)) { if (x.valid) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "a reassigned global collection constructor remains conservatively searchable",
      code: "Set = CustomSet; function f() { for (const x of new Set(items)) { if (x.valid) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "an alias of a shadowed collection constructor remains conservatively searchable",
      code: "function f(Set) { const NativeSet = Set; for (const x of new NativeSet(items)) { if (x) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "an alias of a reassigned global constructor remains conservatively searchable",
      code: "Set = CustomSet; const NativeSet = Set; "
        + "function f() { for (const x of new NativeSet(items)) { if (x) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "a reassigned constructor alias remains conservatively searchable",
      code: "let NativeSet = Set; NativeSet = CustomSet; "
        + "function f() { for (const x of new NativeSet(items)) { if (x) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "a cyclic constructor alias remains conservatively searchable",
      code: "const First = Second; const Second = First; "
        + "function f() { for (const x of new First(items)) { if (x) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "dynamic scope cannot prove a built-in collection",
      code: "function f() { with ({ Set: SearchableSet }) { "
        + "for (const x of new Set(items)) { if (x) return x } } }",
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "dynamic scope cannot prove a collection alias",
      code: "const values = new Set(items); function f() { with ({ values: searchable }) { "
        + "for (const x of values) { if (x) return x } } }",
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "an ambiguously redeclared source remains conservatively searchable",
      code: "function f() { var source = items; var source; for (const x of source) { if (x.valid) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      code: "function f() { for (const x of items) { if (x.valid) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "an unresolved generator-looking call remains conservatively searchable",
      code: "function f() { for (const x of values()) { if (x) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "a reassigned local generator is no longer statically known",
      code: "function* values() { yield 1 }; values = replacement; "
        + "function f() { for (const x of values()) { if (x) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    { code: "function f() { for (const x of items) if (x.valid) return x }", errors: [ { messageId: "preferFind" } ] },
    {
      code: "function f() { for (const x of items) { if (x.valid) return true } }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "a reassigned callback-local can still implement a some search",
      code: "function f(xs) { for (let x of xs) { x = transform(x); if (x.ok) return true } }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "a break owned by a nested switch stays inside the predicate",
      code: "function f(xs) { for (const x of xs) { switch (x.kind) { case 'skip': break }; "
        + "if (x.ok) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "a break owned by a nested loop stays inside the predicate",
      code: "function f(xs, ys) { for (const x of xs) { for (const y of ys) { if (y) break }; "
        + "if (x.ok) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    {
      name: "a true return conditional only for the outer loop marks only that loop",
      code: "function f() { for (const x of xs) { if (ready) for (const y of ys) return true } }",
      errors: 1
    },
    {
      name: "a true return under the inner condition marks both loops",
      code: "function f() { for (const x of xs) { for (const y of ys) { if (ready) return true } } }",
      errors: 2
    },
    {
      name: "a shadowed iteration binding marks only its own loop",
      code: "function f() { for (const x of xs) { for (const x of ys) { if (x) return x } } }",
      errors: 1
    },
    {
      name: "two var declarations sharing a binding mark both loops",
      code: "function f() { for (var x of xs) { for (var x of ys) { if (x) return x } } }",
      errors: 2
    },
    {
      name: "an await in an inner iterable belongs to the outer body only",
      code: "async function f() { for (const x of xs) { for (const y of await ys) { if (y) return y } } }",
      errors: 1
    },
    {
      name: "an await in a nested function does not hide the outer search",
      code: "async function f() { for (const x of xs) { register(async () => await save(x)); if (x) return x } }",
      errors: 1
    },
    {
      name: "does not cache a source whose binding is later reassigned",
      code: "let source = new Set(items); source = items; "
        + "function f() { for (const x of source) { if (x) return x } }",
      errors: 1
    },
    {
      name: "shares a reassigned source result across many loops",
      code: `function f() { let source = new Set(items); source = items; ${searchLoopsOver("source", 80)} }`,
      errors: 80
    }
  ]
})

function nestedLoopsAround(inner, count) {
  return Array.from({ length: count }, (_, index) => count - index - 1)
    .reduce((body, index) => `for (const x${index} of xs${index}) { ${body} }`, inner)
}

function searchLoopsOver(source, count) {
  return Array.from({ length: count }, (_, index) =>
    `for (const item${index} of ${source}) { if (item${index}) return item${index} }`).join(";")
}
