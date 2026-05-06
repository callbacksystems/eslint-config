import rule from "#rules/prefer_for_each"
import { dedent, tester } from "#support"

class NestedCases {
  #count

  constructor(count) {
    this.#count = count
  }

  arrayAliasesWith(method) {
    return [
      "const a0 = []",
      ...this.#indexes.map((index) => `const a${index + 1} = a${index}.${method}(transform)`),
      `for (const item of a${this.#count}) consume(item)`
    ].join("\n")
  }

  loopsAround(inner) {
    return this.#indexes.reduceRight((body, index) =>
      `for (const x${index} of [ ${index} ]) { ${body}; use(x${index}) }`, inner)
  }

  get accumulations() {
    return this.#indexes.reduceRight((inner, index) =>
      `const acc${index} = [], values${index} = [ ${index} ]; `
      + `for (const x${index} of values${index}) { ${inner} acc${index}.push(x${index}) }`, "")
  }

  get convertibleLoops() {
    return this.#indexes.reduceRight((body, index) =>
      `for (const x${index} of [ ${index} ]) { ${body} }`, "consume()")
  }

  get forEachCalls() {
    return this.#indexes.reduceRight((body, index) =>
      `[ ${index} ].forEach((x${index}) => { ${body} })`, "consume()")
  }

  get iterableLoops() {
    return this.#indexes.reduceRight((body, index) =>
      `for (const x${index} of [ () => { ${body} } ]) use(x${index})`, "consume()")
  }

  get iterableForEachCalls() {
    return this.#indexes.reduceRight((body, index) =>
      `[ () => { ${body} } ].forEach((x${index}) => use(x${index}))`, "consume()")
  }

  get #indexes() {
    return Array.from({ length: this.#count }, (_, index) => index)
  }
}

tester.run("prefer-for-each", rule, {
  valid: [
    // Needs control flow `forEach` can't express.
    "for (const x of items) { if (x.skip) continue; use(x) }",
    "for (const x of items) { if (x.stop) break }",
    "function f() { for (const x of items) { if (x.match) return x } }",
    "function f() { for (const x of items) return x }",
    "async function f() { for (const x of items) await save(x) }",
    "async function f() { for (const x of [ 1 ]) { await using resource = open(x); use(resource) } }",
    "async function f() { for (const group of [ groups ]) { for await (const x of group) use(x) } }",
    "function* f() { for (const x of items) yield x }",
    "async function f() { for await (const x of stream) use(x) }",
    "for (const x of [ 1 ]) { switch (x) { case 1: break }; use(x) }",
    "async function f() { for (const x of [ 1 ]) { class C extends (await base(x)) {}; use(C) } }",
    "for (const ch of \"abc\") use(ch)",
    "for (const ch of `tmpl`) use(ch)",
    "items.forEach((x) => use(x))",
    "for (const x of items) use(x)",
    "function f(source) { for (const char of source) use(char) }",
    "for (const item of generator()) consume(item)",
    "for (const [key, value] of map) consume(key, value)",
    "for (const x of names.map(trim)) use(x)",
    "for (const ch of \"abc\".slice(1)) use(ch)",
    "for (const x of custom.map(build)) use(x)",
    "for (const x of new Map(items)) use(x)",
    "for (const x of new String('items')) use(x)",
    "for (const x of new Uint8Array(items)) use(x)",
    "for (const x of items?.filter(keep)) use(x)",
    "for (const x of items.filter?.(keep)) use(x)",
    "for (const x of items.unknown(keep)) use(x)",
    "function f(Array) { for (const x of Array.of(1)) use(x) }",
    "Array = FakeArray; for (const x of Array.of(1)) use(x)",
    "Object = FakeObject; for (const x of Object.keys(value)) use(x)",
    "function f(Set) { for (const x of new Set(items)) use(x) }",
    "Set = FakeSet; for (const x of new Set(items)) use(x)",
    {
      code: "with ({ Set: CustomSet }) { for (const x of new Set(items)) use(x) }",
      languageOptions: { sourceType: "script" }
    },
    "let items = [ 1 ]; for (const x of items) use(x)",
    "const csv = source; for (const x of csv.split(', ')) use(x)",
    "const separator = { [Symbol.split]() { return custom } }; "
    + "for (const x of 'a,b'.split(separator)) use(x)",
    "let csv = 'a,b'; for (const x of csv.split(',')) use(x)",
    "Array.prototype.filter = fake; for (const x of [].filter(keep)) use(x)",
    "Array.prototype.forEach = custom; for (const x of [ 1 ]) use(x)",
    "Array.prototype[Symbol.iterator] = custom; for (const x of [ 1 ]) use(x)",
    "Object.getPrototypeOf([][Symbol.iterator]()).next = custom; for (const x of [ 1 ]) use(x)",
    "Object.getPrototypeOf([].values()).next = custom; for (const x of [ 1 ]) use(x)",
    "Object.getPrototypeOf(new Set().entries()).return = cleanup; for (const x of new Set([ 1 ])) use(x)",
    "Object.getPrototypeOf([][Symbol.iterator]()).return = cleanup; for (const x of [ 1 ]) use(x)",
    "Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())).return = cleanup; "
    + "for (const x of [ 1 ]) use(x)",
    "const iteratorPrototype = Object.getPrototypeOf(new Set()[Symbol.iterator]()); "
    + "Object.defineProperty(iteratorPrototype, 'next', { value: custom }); "
    + "for (const x of new Set([ 1 ])) use(x)",
    "Array.prototype.forEach &&= custom; for (const x of [ 1 ]) use(x)",
    "Set.prototype.forEach = custom; for (const x of new Set([ 1 ])) use(x)",
    "Set.prototype[Symbol.iterator] = custom; for (const x of new Set([ 1 ])) use(x)",
    "const values = []; values.constructor = custom; for (const x of values.map(transform)) use(x)",
    "const values = []; consume(values); for (const x of values.filter(keep)) use(x)",
    "const values = []; const alias = values; consume(alias); for (const x of values.filter(keep)) use(x)",
    "const values = []; for (const x of values.filter((consume(values), keep))) use(x)",
    "const values = []; while (condition) { "
    + "for (const x of values.filter(keep)) use(x); consume(values) }",
    "for (var x of [ 1, 2 ]) use(x)",
    "for (using resource of [ open() ]) consume(resource)",
    "for (const x of [ 1, , 3 ]) use(x)",
    dedent`
      const items = [ 1, 2 ]
      for (const item of items) {
        items.push(item)
      }
    `,
    dedent`
      const names = [ "root" ]
      for (const item of items) names.push(item.name)
    `,
    dedent`
      const rows = buildRows()
      for (const [key, value] of rows) consume(key, value)
    `,
    // Control flow in a nested loop keeps the outer one too.
    "for (const row of rows) { for (const cell of row) { if (cell) break } }",
    // A loop filling an array declared empty above it is `no-manual-accumulation`'s, which points at `map`.
    dedent`
      const names = []
      for (const item of items) names.push(item.name)
    `,
    // Cyclic binding evidence neither recurses nor masquerades as an array.
    "const items = items; for (const item of items) consume(item)",
    "const first = second; const second = first; for (const item of first) consume(item)",
    "const first = second.map(trim); const second = first.map(trim); for (const item of first) consume(item)",
    "function f() { for (const item of items) consume(item); const items = [] }",
    "function f() { for (const item of items) consume(item); const items = new Set(source) }",
    "function f() { return; const items = []; for (const item of items) consume(item) }",
    "function f() { return; const items = new Set(source); for (const item of items) consume(item) }",
    "const items = new Set(source); inspect(items); for (const item of items) consume(item)",
    "const items = new Set(source); items.forEach = custom; for (const item of items) consume(item)",
    "const items = new Set(source); const alias = items; for (const item of alias) consume(item)",
    "for (const [key, value] of Object.entries(config)) consume(key, value)",
    "const values = []; use(values.length); for (const x of values.filter(keep)) use(x)",
    "const values = []; for (const x of values.filter(keep)) use(x); consume(values)",
    "for (const value of new Set(items)) consume(value)",
    "const Collection = Set; for (const value of new Collection(items)) consume(value)",
    "for (const [first, second] of new Set(pairs)) consume(first, second)",
    dedent`
      const rows = Object.entries(config)
      for (const [key, value] of rows) consume(key, value)
    `,
    dedent`
      const items = new Set(source)
      for (const item of items) consume(item)
    `,
    {
      name: "does not follow a deferred Set whose construction can execute its source",
      code: "function f() { for (const item of items) consume(item) }; const items = new Set(source)"
    },
    { name: "handles deep sparse array aliases iteratively", code: new NestedCases(1_200).arrayAliasesWith("map") },
    {
      name: "keeps deep effectful producer aliases conservative",
      code: new NestedCases(1_200).arrayAliasesWith("filter")
    },
    { name: "indexes escapes once across deeply nested loops", code: new NestedCases(600).loopsAround("break") }
  ],
  invalid: [
    {
      name: "keeps the diagnostic when logical assignment preserves native array iteration",
      code: "Array.prototype.forEach ||= custom; for (const item of [ 1 ]) use(item)",
      output: "Array.prototype.forEach ||= custom; [ 1 ].forEach((item) => use(item))",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      name: "keeps the diagnostic when nullish assignment preserves the native array iterator",
      code: "Array.prototype[Symbol.iterator] ??= custom; for (const item of [ 1 ]) use(item)",
      output: "Array.prototype[Symbol.iterator] ??= custom; [ 1 ].forEach((item) => use(item))",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      name: "keeps the diagnostic when logical assignment preserves native iterator next",
      code: "Object.getPrototypeOf([][Symbol.iterator]()).next ||= custom; for (const item of [ 1 ]) use(item)",
      output: "Object.getPrototypeOf([][Symbol.iterator]()).next ||= custom; "
        + "[ 1 ].forEach((item) => use(item))",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      name: "keeps the diagnostic when logical assignment preserves an absent iterator return",
      code: "Object.getPrototypeOf([][Symbol.iterator]()).return &&= cleanup; for (const item of [ 1 ]) use(item)",
      output: "Object.getPrototypeOf([][Symbol.iterator]()).return &&= cleanup; "
        + "[ 1 ].forEach((item) => use(item))",
      errors: [ { messageId: "preferForEach" } ]
    },
    // Comments in loop scaffolding are not represented in the generated callback, so the report remains fixless.
    {
      code: "for /* keep */ (const item of [ 1 ]) use(item)",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (const /* keep */ item of [ 1 ]) use(item)",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    // A coverage directive above the loop must not be retargeted to a newly introduced callback expression.
    {
      code: "/* istanbul ignore next */\nfor (const item of [ 1 ]) use(item)",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    // Dynamic lookup does not weaken the diagnostic, but moving the body into a callback is unsafe.
    {
      code: "function f() { eval(source); for (const x of [ 1 ]) use(x) }",
      output: null,
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "with (scope) { for (const x of [ 1 ]) use(x) }",
      output: null,
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "preferForEach" } ]
    },
    // The binding pattern becomes an arrow parameter, where await and yield defaults are invalid.
    {
      code: "async function f() { for (const [x = await value] of [[]]) use(x) }",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "function* f() { for (const [x = yield value] of [[]]) use(x) }",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    // A loop block is not a directive prologue, but the generated callback body would be one.
    {
      code: "for (const [x] of [[ 1 ]]) { \"custom\"; \"use strict\"; use(x) }",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (const [x] of [[ 1 ]]) { (\"use strict\"); use(x) }",
      output: "[[ 1 ]].forEach(([x]) => { (\"use strict\"); use(x) })",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: String.raw`for (const [x] of [[ 1 ]]) { "use\x20strict"; use(x) }`,
      output: String.raw`[[ 1 ]].forEach(([x]) => { "use\x20strict"; use(x) })`,
      errors: [ { messageId: "preferForEach" } ]
    },
    // Moving the loop binding behind the RHS would bypass its temporal dead zone.
    {
      code: "const x = 1; for (const x of Array.of(x)) use(x)",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "const x = 1; for (const { x } of [ { x } ]) use(x)",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    // Arrow parameters are mutable, so writing a const iteration binding would change behavior.
    { code: "for (const x of [ 1 ]) x = 2", output: null, errors: [ { messageId: "preferForEach" } ] },
    {
      code: "for (const x of [ 1 ]) register(() => { x += 1 })",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (const [x, y = (x = 2)] of [[ 1 ]]) use(x, y)",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (let x of [ 1 ]) x = 2",
      output: "[ 1 ].forEach((x) => x = 2)",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: dedent`
        const items = [ 1, 2 ]
        for (const x of items) use(x)
      `,
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (const [key, value] of Object.entries({ key: value })) consume(key, value)",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (const x of [ 1 ].filter((value) => value)) use(x)",
      output: "[ 1 ].filter((value) => value).forEach((x) => use(x))",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (const x of [ 1 ].filter((value) => !value)) use(x); consume(values)",
      output: "[ 1 ].filter((value) => !value).forEach((x) => use(x)); consume(values)",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (const value of Array[\"of\"](1, 2)) consume(value)",
      output: "Array[\"of\"](1, 2).forEach((value) => consume(value))",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (const value of \"a,b\".split(\",\")) consume(value)",
      output: "\"a,b\".split(\",\").forEach((value) => consume(value))",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (const value of new Set([ 1 ])) consume(value)",
      output: "new Set([ 1 ]).forEach((value) => consume(value))",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "const Collection = Set; for (const value of new Collection([ 1 ])) consume(value)",
      output: "const Collection = Set; new Collection([ 1 ]).forEach((value) => consume(value))",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (const value of new Set) consume(value)",
      output: "(new Set).forEach((value) => consume(value))",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (const [first, second] of new Set([ [ 1, 2 ] ])) consume(first, second)",
      output: "new Set([ [ 1, 2 ] ]).forEach(([first, second]) => consume(first, second))",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "const csv = `a,b`; for (const value of csv.split(\",\")) consume(value)",
      output: "const csv = `a,b`; csv.split(\",\").forEach((value) => consume(value))",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: dedent`
        const rows = Object.entries({ key: value })
        for (const [key, value] of rows) consume(key, value)
      `,
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: dedent`
        const items = new Set([ 1 ])
        for (const item of items) consume(item)
      `,
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      name: "follows a deferred array binding declared after the function",
      code: "function f() { for (const item of items) consume(item) }; const items = []",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      name: "follows a deferred Set binding declared after the function",
      code: "function f() { for (const item of items) consume(item) }; const items = new Set([ 1 ])",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: dedent`
        const items = [ 1, 2 ]
        for (const x of items) if (x) use(x)
      `,
      output: null,
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
      code: "for (const item of [ 1, 2 ]) if (item) consume(item)",
      output: "[ 1, 2 ].forEach((item) => { if (item) consume(item) })",
      errors: [ { messageId: "preferForEach" } ]
    },
    // Replacing the loop with an expression would let the following `[` continue that expression.
    {
      code: "for (const x of [ 1 ]) { use(x) }\n[ 2 ].forEach(use)",
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (const item of [ 1 ]) use(item); next()",
      output: "[ 1 ].forEach((item) => use(item)); next()",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (const item of [ 1 ]) (/* keep */ use(item));",
      output: "[ 1 ].forEach((item) => (/* keep */ use(item)))",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: "for (const x of [ 1 ]) for (const y of [ 2 ]) use(x, y); next()",
      output: "[ 1 ].forEach((x) => { [ 2 ].forEach((y) => use(x, y)); }); next()",
      errors: 2
    },
    {
      code: "for (const item of [ 1 ]) { use(item) } [ 2 ].forEach(use)",
      output: "[ 1 ].forEach((item) => { use(item) }); [ 2 ].forEach(use)",
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: dedent`
        function consumeAll() {
          for (const item of [ 1, 2 ]) {
            var last = item
            consume(item)
          }
          use(last)
        }
      `,
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: dedent`
        for (const item of [ 1, 2 ]) {
          function consumeItem() { consume(item) }
          consumeItem()
        }
        consumeItem()
      `,
      output: null,
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: dedent`
        for (const item of [ 1 ]) {
          run(() => {
            var local = item
            consume(local)
          })
        }
      `,
      output: dedent`
        [ 1 ].forEach((item) => {
          run(() => {
            var local = item
            consume(local)
          })
        })
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
      output: null,
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
      output: null,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      name: "indexes accumulation flow once across deeply nested candidates",
      code: new NestedCases(400).accumulations,
      errors: 399
    },
    {
      name: "fixes deeply nested loops together without overlapping edits",
      code: new NestedCases(24).convertibleLoops,
      output: new NestedCases(24).forEachCalls,
      errors: 24
    },
    {
      name: "fixes a nested loop without replacing its parent's iterable",
      code: "for (const fn of [() => { for (const y of [ 2 ]) use(y) }]) use(fn)",
      output: "[() => { [ 2 ].forEach((y) => use(y)) }].forEach((fn) => use(fn))",
      errors: 2
    },
    {
      name: "fixes deeply nested iterable loops in one bounded replacement",
      code: new NestedCases(40).iterableLoops,
      output: new NestedCases(40).iterableForEachCalls,
      errors: 40
    },
    // A batched fix must not transform a nested diagnostic controlled independently by ESLint directives.
    {
      code: dedent`
        for (const x of [ 1 ]) {
          /* eslint-disable rule-to-test/prefer-for-each */

          use(x);
          for (const y of [ 2 ]) use(x, y)
        }
      `,
      output: dedent`
        [ 1 ].forEach((x) => {
          /* eslint-disable rule-to-test/prefer-for-each */

          use(x);
          for (const y of [ 2 ]) use(x, y)
        })
      `,
      errors: [ { messageId: "preferForEach" } ]
    },
    {
      code: dedent`
        /* eslint-disable rule-to-test/prefer-for-each */

        for (const x of [ 1 ]) {
          /* eslint-enable rule-to-test/prefer-for-each */

          use(x);
          for (const y of [ 2 ]) use(x, y)
        }
      `,
      output: dedent`
        /* eslint-disable rule-to-test/prefer-for-each */

        for (const x of [ 1 ]) {
          /* eslint-enable rule-to-test/prefer-for-each */

          use(x);
          [ 2 ].forEach((y) => use(x, y))
        }
      `,
      errors: [ { messageId: "preferForEach" } ]
    }
  ]
})
