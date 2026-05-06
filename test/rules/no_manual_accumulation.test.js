import rule from "#rules/no_manual_accumulation"
import { dedent, tester } from "#support"

tester.run("no-manual-accumulation", rule, {
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
    `,
    dedent`
      const acc = []
      items.forEach((x) => { log(x); acc.push(x) })
    `
  ],
  invalid: [
    {
      code: dedent`
        const acc = []
        for (const x of items) acc.push(x * 2)
      `,
      errors: [ { messageId: "manualAccumulation" } ]
    },
    {
      code: dedent`
        const out = {}
        for (const x of items) out[x] = x
      `,
      errors: [ { messageId: "manualAccumulation" } ]
    },
    {
      code: dedent`
        const m = new Map()
        for (const x of items) m.set(x, x)
      `,
      errors: [ { messageId: "manualAccumulation" } ]
    },
    {
      code: dedent`
        const acc = []
        items.forEach((x) => acc.push(x * 2))
      `,
      errors: [ { messageId: "manualAccumulation" } ]
    },
    {
      code: dedent`
        const acc = []
        items.forEach((x) => { if (x > 5) acc.push(x) })
      `,
      errors: [ { messageId: "manualAccumulation" } ]
    }
  ]
})
