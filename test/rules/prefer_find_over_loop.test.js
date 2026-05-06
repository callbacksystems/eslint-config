import rule from "#rules/prefer_find_over_loop"
import { tester } from "#support"

tester.run("prefer-find-over-loop", rule, {
  valid: [
    // No return: a plain iteration, not a search.
    "for (const x of items) use(x)",
    "for (const x of items) { if (x.skip) continue; use(x) }",
    // The return belongs to a nested function, not the loop.
    "for (const x of items) { register(() => { if (x) return x }) }",
    // `for await` is left alone: `find`/`some` cannot await.
    "async function f() { for await (const x of items) { if (await ok(x)) return x } }"
  ],
  invalid: [
    {
      code: "function f() { for (const x of items) { if (x.valid) return x } }",
      errors: [ { messageId: "preferFind" } ]
    },
    // A non-block body works the same way.
    { code: "function f() { for (const x of items) if (x.valid) return x }", errors: [ { messageId: "preferFind" } ] },
    // A conditional boolean return reads as `.some()`.
    {
      code: "function f() { for (const x of items) { if (x.valid) return true } }",
      errors: [ { messageId: "preferFind" } ]
    }
  ]
})
