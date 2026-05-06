import rule from "#rules/no_mixed_memoization"
import { tester } from "#support"

tester.run("no-mixed-memoization", rule, {
  valid: [
    "class C { #user; get user() { return this.#user ??= load() } }",
    "class C { #user; getUser() { this.#user ??= load(); return this.#user } }",
    "class C { #period; get period() { if (this.ready) this.#period ??= compute(); return this.#period } }",
    "class C { #period; get period() { if (this.ready) { this.#period ??= compute() } return this.#period } }",
    "class C { #processor; get processor() { try { return this.#processor ??= find() } catch { return null } } }",
    "class C { run() { validate(); execute() } }",
    "class C { #value; run() { return items.map(() => this.#value ??= load()) } }",
    "class C { value(key) { return this[key] ??= load() } }",
    "class C { value() { return this[`cache`] ??= load() } }",
    "class C { value() { this.cache ??= load(); return this[\"cache\"] } }",
    "class C { value() { this[\"cache\"] ??= load(); return this.cache } }",
    "class C { value() { this[\"\"] ??= load(); return this[\"\"] } }",
    "class C { value() { return class Nested { field = (this.cache ??= load()) } } }",
    "class C { value() { return class Nested { static { this.cache ??= load() } } } }",
    { name: "indexes memoization ownership once at depth", code: deepMemoizationsWith(300) },
    { name: "walks deeply nested related statements iteratively", code: deeplyNestedStatementsWith(600) }
  ],
  invalid: [
    {
      code: "class C { #user; getUser() { validate(); return this.#user ??= load() } }",
      errors: [ { messageId: "mixedMemoization" } ]
    },
    {
      code: "class C { #user; getUser() { this.#user ??= load(); log() } }",
      errors: [ { messageId: "mixedMemoization" } ]
    },
    {
      code: "class C { #total; get total() { const base = 10; return this.#total ??= base + extra() } }",
      errors: [ { messageId: "mixedMemoization" } ]
    },
    {
      code: "class C { #a; #b; init() { this.#a ??= x(); this.#b ??= y() } }",
      errors: [ { messageId: "mixedMemoization" } ]
    },
    {
      code: "class C { #a; #b; init() { this.#a ??= x(); return this.#b } }",
      errors: [ { messageId: "mixedMemoization" } ]
    },
    {
      code: "class C { #x; value() { this.#x ??= load(); return this[\"#x\"] } }",
      errors: [ { messageId: "mixedMemoization" } ]
    },
    {
      code: "class C { #value; get value() { try { return this.#value ??= load() } catch { log(); return null } } }",
      errors: [ { messageId: "mixedMemoization" } ]
    },
    {
      code: "class C { #value; get value() { try { return this.#value ??= load() } finally { log() } } }",
      errors: [ { messageId: "mixedMemoization" } ]
    },
    {
      code: "class C { #value; value() { class Nested { [this.#value ??= load()]() {} } log() } }",
      errors: [ { messageId: "mixedMemoization" } ]
    }
  ]
})

function deepMemoizationsWith(depth) {
  return `class C { #value; value() { ${"if (ready) {".repeat(depth)} `
    + `${Array.from({ length: depth }, () => "this.#value ??= load()").join(";")} `
    + `${"}".repeat(depth)} return this.#value } }`
}

function deeplyNestedStatementsWith(depth) {
  const guarded = `${"if (ready) {".repeat(depth)} return this.#value ??= load() ${"}".repeat(depth)}`
  const fallback = `${"if (failed) {".repeat(depth)} throw failure ${"}".repeat(depth)}`
  return `class C { #value; value() { try { ${guarded} } catch { ${fallback} } } }`
}
