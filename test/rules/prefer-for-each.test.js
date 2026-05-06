import rule from "#rules/prefer-for-each"
import { dedent, tester } from "#test/support"

tester.run("prefer-for-each", rule, {
  valid: [
    // Needs control flow `forEach` can't express.
    "for (const x of items) { if (x.skip) continue; use(x) }",
    "for (const x of items) { if (x.stop) break }",
    "function f() { for (const x of items) { if (x.match) return x } }",
    "async function f() { for (const x of items) await save(x) }",
    "function* f() { for (const x of items) yield x }",
    // `for await...of` cannot be forEach.
    "async function f() { for await (const x of stream) use(x) }",
    // String iteration has no `.forEach`.
    "for (const ch of \"abc\") use(ch)",
    "for (const ch of `tmpl`) use(ch)",
    // Already declarative.
    "items.forEach((x) => use(x))",
    // Control flow inside a nested loop still skips (conservative).
    "for (const row of rows) { for (const cell of row) { if (cell) break } }"
  ],
  invalid: [
    {
      code: "for (const x of items) use(x)",
      output: "items.forEach((x) => use(x))",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: dedent`
        for (const item of list) {
          process(item)
          log(item)
        }
      `,
      output: dedent`
        list.forEach((item) => {
          process(item)
          log(item)
        })
      `,
      errors: [ { messageId: "preferForEach" } ]
    },
    // A nested function's return does not count as the loop's control flow.
    {
      code: dedent`
        for (const x of items) {
          register(() => {
            return x
          })
        }
      `,
      output: dedent`
        items.forEach((x) => {
          register(() => {
            return x
          })
        })
      `,
      errors: [ { messageId: "preferForEach" } ]
    }
  ]
})
