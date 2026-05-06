import rule from "#rules/prefer-for-each"
import { dedent, tester } from "#support"

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
    // A call may hand back a generator, which has no `forEach`: reported, unfixed.
    { code: "for (const item of generator()) consume(item)", output: null, errors: [ { messageId: "preferForEach" } ] },
    // A destructured element is how a `Map` entry is read, and `Map.prototype.forEach` passes `(value, key)` instead:
    // reported, unfixed.
    {
      code: "for (const [key, value] of map) consume(key, value)",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    // Both shapes are fixed once the array is in evidence.
    {
      code: "for (const [key, value] of Object.entries(config)) consume(key, value)",
      output: "Object.entries(config).forEach(([key, value]) => consume(key, value))",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (const x of names.map(trim)) use(x)",
      output: "names.map(trim).forEach((x) => use(x))",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: dedent`
        const rows = buildRows()
        for (const [key, value] of rows) consume(key, value)
      `,
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: dedent`
        const rows = Object.entries(config)
        for (const [key, value] of rows) consume(key, value)
      `,
      output: dedent`
        const rows = Object.entries(config)
        rows.forEach(([key, value]) => consume(key, value))
      `,
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
