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
      const acc = []
      for (const x of items) {
        if (x > 5) continue
        acc.push(x)
      }
    `,
    dedent`
      const acc = []
      items.forEach((x) => {
        if (!x) return
        acc.push(x)
      })
    `,
    dedent`
      const acc = []
      for (const x of items) {
        if (!x) throw new Error("missing")
        acc.push(x)
      }
    `,
    dedent`
      const acc = []
      outer: for (const x of items) {
        switch (x.kind) {
          case "person": acc.push(x.name); break outer
        }
      }
    `,
    dedent`
      const result = []
      for (const x of items) doSomething(x)
    `,
    dedent`
      const acc = []
      items.forEach((x) => { log(x); acc.push(x) })
    `,
    dedent`
      const acc = []
      for (const x of items) {
        if (x.ok) acc.push(x)
        else log(x)
      }
    `,
    dedent`
      const acc = []
      for (const x of items) {
        switch (x.kind) {
          case "person": acc.push(x.name); break
          default: log(x)
        }
      }
    `,
    dedent`
      const acc = []
      for (const x of items) {
        if (x.ok) acc.push(x)
        else other.push(x)
      }
    `,
    dedent`
      const acc = []
      for (const x of items) {}
    `,
    dedent`
      const acc = []
      for (const x of items) {
        if (x.ok) {}
      }
    `,
    dedent`
      const acc = [ 1 ]
      for (const x of items) acc.push(x)
    `,
    {
      name: "does not rescan deeply nested loops without accumulation candidates",
      code: nestedLoopsAround("use()", 600)
    },
    dedent`
      const acc = []
      for (const x of items) acc.unshift(x)
    `,
    dedent`
      const acc = []
      for (const x of items) acc.length = x
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
    },
    {
      code: dedent`
        const acc = []
        for (let i = 0; i < items.length; i++) acc[i] = items[i] * 2
      `,
      errors: [ { messageId: "manualAccumulation", data: { suggestion: "`map`/`filter`/`flatMap`" } } ]
    },
    {
      code: dedent`
        const acc = []
        items.forEach((x, i) => { acc[i] = x.name })
      `,
      errors: [ { messageId: "manualAccumulation" } ]
    },
    {
      code: dedent`
        const acc = []
        for (const x of items) {
          if (x.ok) acc.push(x)
          else acc.push(fallback)
        }
      `,
      errors: [ { messageId: "manualAccumulation" } ]
    },
    {
      code: dedent`
        const acc = []
        for (const x of items) {
          if (x.ok) acc.push(x.name)
          else if (x.legacy) acc.push(x.title)
          else acc.push(x.id)
        }
      `,
      errors: [ { messageId: "manualAccumulation" } ]
    },
    {
      code: dedent`
        const acc = []
        for (const x of items) {
          if (x.ok) {
            if (x.active) acc.push(x.name)
          }
        }
      `,
      errors: [ { messageId: "manualAccumulation" } ]
    },
    {
      code: dedent`
        const acc = []
        for (const x of items) {
          switch (x.kind) {
            case "person":
              acc.push(x.name)
              break
            case "company":
              acc.push(x.legalName)
              break
          }
        }
      `,
      errors: [ { messageId: "manualAccumulation" } ]
    },
    {
      code: dedent`
        const acc = []
        items.forEach((x) => {
          switch (x.kind) {
            case "person": acc.push(x.name); break
            default: acc.push(x.id)
          }
        })
      `,
      errors: [ { messageId: "manualAccumulation" } ]
    },
    {
      code: dedent`
        const acc = []
        log("collecting")
        for (const x of items) acc.push(x)
      `,
      errors: [ { messageId: "manualAccumulation" } ]
    },
    {
      code: dedent`
        const acc = []
        const other = {}
        for (const x of items) acc.push(x)
      `,
      errors: [ { messageId: "manualAccumulation" } ]
    },
    {
      code: dedent`
        function build() {
          const out = {}
          for (const x of items) {
            switch (x.kind) {
              case "person": out[x.id] = x.name; break
              default: out[x.id] = x.title
            }
          }
          return out
        }
      `,
      errors: [ { messageId: "manualAccumulation", data: { suggestion: "`Object.fromEntries(items.map(...))`" } } ]
    }
  ]
})

function nestedLoopsAround(inner, count) {
  return Array.from({ length: count }, (_, index) => count - index - 1)
    .reduce((body, index) => `for (const x${index} of [ 1 ]) { ${body} }`, inner)
}
