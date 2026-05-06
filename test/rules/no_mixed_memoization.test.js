import rule from "#rules/no_mixed_memoization"
import { tester } from "#support"

tester.run("no-mixed-memoization", rule, {
  valid: [
    "class C { #user; get user() { return this.#user ??= load() } }",
    // Memoize, then return the memoized field.
    "class C { #user; getUser() { this.#user ??= load(); return this.#user } }",
    "class C { #a; #b; init() { this.#a ??= x(); this.#b ??= y() } }",
    // Guarded memoization, then return the field.
    "class C { #period; get period() { if (this.ready) this.#period ??= compute(); return this.#period } }",
    // Memoization wrapped in try/catch.
    "class C { #processor; get processor() { try { return this.#processor ??= find() } catch { return null } } }",
    // No memoization at all.
    "class C { run() { validate(); execute() } }"
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
    }
  ]
})
