import rule from "#rules/no-loop-accumulator"
import { dedent, tester } from "#test/helpers"

tester.run("no-loop-accumulator", rule, {
  valid: [
    "const out = items.map(x => x * 2)",
    dedent`
      const acc = []
      for (const x of items) {
        if (x > 5) break
        acc.push(x)
      }
    `,
    dedent`
      const result = []
      for (const x of items) doSomething(x)
    `
  ],
  invalid: [
    {
      code: dedent`
        const acc = []
        for (const x of items) acc.push(x * 2)
      `,
      errors: [ { messageId: "noLoopAccumulator" } ]
    },
    {
      code: dedent`
        const out = {}
        for (const x of items) out[x] = x
      `,
      errors: [ { messageId: "noLoopAccumulator" } ]
    },
    {
      code: dedent`
        const m = new Map()
        for (const x of items) m.set(x, x)
      `,
      errors: [ { messageId: "noLoopAccumulator" } ]
    }
  ]
})
