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
    "async function f() { for await (const x of items) { if (await ok(x)) return x } }"
  ],
  invalid: [
    {
      code: "function f() { for (const x of items) { if (x.valid) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    { code: "function f() { for (const x of items) if (x.valid) return x }", errors: [ { messageId: "preferFind" } ] },
    {
      code: "function f() { for (const x of items) { if (x.valid) return true } }",
      errors: [ { messageId: "preferFind" } ]
    }
  ]
})
