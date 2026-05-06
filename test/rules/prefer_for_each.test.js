import rule from "#rules/prefer_for_each"
import { dedent, tester } from "#support"

tester.run("prefer-for-each", rule, {
  valid: [
    // Needs control flow `forEach` can't express.
    "for (const x of items) { if (x.skip) continue; use(x) }",
    "for (const x of items) { if (x.stop) break }",
    "function f() { for (const x of items) { if (x.match) return x } }",
    "function f() { for (const x of items) return x }",
    "async function f() { for (const x of items) await save(x) }",
    "function* f() { for (const x of items) yield x }",
    "async function f() { for await (const x of stream) use(x) }",
    "for (const ch of \"abc\") use(ch)",
    "for (const ch of `tmpl`) use(ch)",
    "items.forEach((x) => use(x))",
    // Control flow in a nested loop keeps the outer one too.
    "for (const row of rows) { for (const cell of row) { if (cell) break } }",
    // A loop filling an array declared empty above it is `no-manual-accumulation`'s, which points at `map`.
    dedent`
      const names = []
      for (const item of items) names.push(item.name)
    `
  ],
  invalid: [
    // An identifier not shown to be an array may hold a string or a generator, so no fix.
    { code: "for (const x of items) use(x)", output: null, errors: [ { messageId: "preferForEach" } ] },
    // Pushing into an array that starts with content is not an accumulation `map` could replace.
    {
      code: dedent`
        const names = [ "root" ]
        for (const item of items) names.push(item.name)
      `,
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "function f(source) { for (const char of source) use(char) }",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: dedent`
        const items = [ 1, 2 ]
        for (const x of items) use(x)
      `,
      output: dedent`
        const items = [ 1, 2 ]
        items.forEach((x) => use(x))
      `,
      errors: [ { messageId: "preferForEach" } ]
    },
    { code: "for (const item of generator()) consume(item)", output: null, errors: [ { messageId: "preferForEach" } ] },
    // A `Map` entry destructures the same way, but `Map.prototype.forEach` passes `(value, key)`, so no fix.
    {
      code: "for (const [key, value] of map) consume(key, value)",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
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
        const items = [ 1, 2 ]
        for (const x of items) if (x) use(x)
      `,
      output: dedent`
        const items = [ 1, 2 ]
        items.forEach((x) => { if (x) use(x) })
      `,
      errors: [ { messageId: "preferForEach" } ]
    },
    // A leading `[` would continue the line above it, so no fix.
    {
      code: dedent`
        const total = count()
        for (const item of [ 1, 2 ]) use(item, total)
      `,
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    // The loop above becomes a `.forEach()` in the same pass, so the brace it closes with is not there for long.
    {
      code: dedent`
        for (const row of [ 3, 4 ]) {
          use(row)
        }
        for (const item of [ 1, 2 ]) use(item)
      `,
      output: dedent`
        [ 3, 4 ].forEach((row) => {
          use(row)
        })
        for (const item of [ 1, 2 ]) use(item)
      `,
      errors: [ { messageId: "preferForEach" }, { messageId: "preferForEach" } ]
    },
    // Inside a `case`, a block above closes the line the same way.
    {
      code: dedent`
        switch (kind) {
          case 1: {
            prepare()
          }
          for (const item of [ 1, 2 ]) use(item)
        }
      `,
      output: dedent`
        switch (kind) {
          case 1: {
            prepare()
          }
          [ 1, 2 ].forEach((item) => use(item))
        }
      `,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: dedent`
        function f() {
          for (const item of [ 1, 2 ]) use(item)
        }
      `,
      output: dedent`
        function f() {
          [ 1, 2 ].forEach((item) => use(item))
        }
      `,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: dedent`
        const list = [ 1, 2 ]
        for (const item of list) {
          process(item)
          log(item)
        }
      `,
      output: dedent`
        const list = [ 1, 2 ]
        list.forEach((item) => {
          process(item)
          log(item)
        })
      `,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: dedent`
        const items = [ 1, 2 ]
        for (const x of items) {
          register(() => {
            return x
          })
        }
      `,
      output: dedent`
        const items = [ 1, 2 ]
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
