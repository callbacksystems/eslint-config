import rule from "#rules/prefer_switch_over_if_chain"
import { dedent, tester } from "#support"

tester.run("prefer-switch-over-if-chain", rule, {
  valid: [
    "if (x === 1) doA(); else doB()",
    dedent`
      if (x === 1) doA()
      else if (y === 2) doB()
    `,
    dedent`
      if (x === 1) doA()
      else doB()
    `,
    dedent`
      if (x[i] === 1) doA()
      else if (x[i] === 2) doB()
      else if (x[i] === 3) doC()
    `,
    dedent`
      if (a.b.c === 1) doA()
      else if (a.b.c === 2) doB()
      else if (a.b.c === 3) doC()
    `,
    dedent`
      if (this.a === 1) doA()
      else if (this.b === 2) doB()
      else if (this.c === 3) doC()
    `
  ],
  invalid: [
    // A comment trailing a bare branch closes its case body, one on a line of its own follows it.
    {
      code: dedent`
        if (kind === "a") doA() // first
        // Second.
        else if (kind === "b") doB()
        else if (kind === "c") doC()
      `,
      output: dedent`
        switch (kind) {
          case "a":
            doA() // first
            break
            // Second.
          case "b":
            doB()
            break
          case "c":
            doC()
            break
        }
      `,
      errors: [ { messageId: "preferSwitch" } ]
    },
    {
      code: dedent`
        if (kind === "a") { // first
          use(first())
        } else if (kind === "b") {
          use(second())
        } else if (kind === "c") {
          use(third())
        }
      `,
      output: dedent`
        switch (kind) {
          case "a": // first
            use(first())
            break
          case "b":
            use(second())
            break
          case "c":
            use(third())
            break
        }
      `,
      errors: [ { messageId: "preferSwitch" } ]
    },
    // Cases share one scope, so a branch declaring a binding keeps its braces.
    {
      code: dedent`
        if (kind === "a") {
          const result = first()
          use(result)
        } else if (kind === "b") {
          const result = second()
          use(result)
        } else if (kind === "c") {
          const result = third()
          use(result)
        }
      `,
      output: dedent`
        switch (kind) {
          case "a": {
            const result = first()
            use(result)
            break
          }
          case "b": {
            const result = second()
            use(result)
            break
          }
          case "c": {
            const result = third()
            use(result)
            break
          }
        }
      `,
      errors: [ { messageId: "preferSwitch" } ]
    },
    {
      code: dedent`
        if (kind === "a") {
          // explains a
          doA()
        } else if (kind === "b") {
          doB() // trailing b
        } else if (kind === "c") {
          doC()
        }
      `,
      output: dedent`
        switch (kind) {
          case "a":
            // explains a
            doA()
            break
          case "b":
            doB() // trailing b
            break
          case "c":
            doC()
            break
        }
      `,
      errors: [ { messageId: "preferSwitch" } ]
    },
    {
      code: dedent`
        if (kind === "a") doA()
        else if (kind === "b") doB()
        else if (kind === "c") doC()
      `,
      output: dedent`
        switch (kind) {
          case "a":
            doA()
            break
          case "b":
            doB()
            break
          case "c":
            doC()
            break
        }
      `,
      errors: [ { messageId: "preferSwitch" } ]
    },
    {
      code: dedent`
        if (kind === "a") doA()
        else if (kind === "b") doB()
      `,
      output: dedent`
        switch (kind) {
          case "a":
            doA()
            break
          case "b":
            doB()
            break
        }
      `,
      options: [ { min: 2 } ],
      errors: [ { messageId: "preferSwitch" } ]
    },
    {
      code: dedent`
        if (action === 1) handle1()
        else if (action === 2) handle2()
        else if (action === 3) handle3()
        else handleDefault()
      `,
      output: dedent`
        switch (action) {
          case 1:
            handle1()
            break
          case 2:
            handle2()
            break
          case 3:
            handle3()
            break
          default:
            handleDefault()
        }
      `,
      errors: [ { messageId: "preferSwitch" } ]
    },
    // A `break` inside a loop of the branch's own is that loop's, so the switch does not swallow it.
    {
      code: dedent`
        if (kind === "a") {
          for (const item of items) {
            if (item.done) break
            use(item)
          }
        } else if (kind === "b") {
          doB()
        } else if (kind === "c") {
          doC()
        }
      `,
      output: dedent`
        switch (kind) {
          case "a":
            for (const item of items) {
              if (item.done) break
              use(item)
            }
            break
          case "b":
            doB()
            break
          case "c":
            doC()
            break
        }
      `,
      errors: [ { messageId: "preferSwitch" } ]
    },
    // A bare `break` leaving the loop would be swallowed by the switch, so no fix.
    {
      code: dedent`
        for (const item of items) {
          if (item.kind === "a") doA()
          else if (item.kind === "b") break
          else if (item.kind === "c") doC()
        }
      `,
      output: null,
      errors: [ { messageId: "preferSwitch" } ]
    },
    // A labeled `break` names its loop, so the switch cannot swallow it.
    {
      code: dedent`
        rows: for (const row of rows) {
          if (row.kind === "a") {
            for (const cell of row.cells) {
              if (cell.stop) break rows
            }
          } else if (row.kind === "b") {
            doB()
          } else if (row.kind === "c") {
            doC()
          }
        }
      `,
      output: dedent`
        rows: for (const row of rows) {
          switch (row.kind) {
            case "a":
              for (const cell of row.cells) {
                if (cell.stop) break rows
              }
              break
            case "b":
              doB()
              break
            case "c":
              doC()
              break
          }
        }
      `,
      errors: [ { messageId: "preferSwitch" } ]
    },
    // A blank line inside a body stays blank, and an over-indented body comes out at the case's own indent.
    {
      code: dedent`
        if (kind === "a") {
          first()

          second()
        } else if (kind === "b") {
              doB()
              log()
        } else if (kind === "c") {
          doC()
        }
      `,
      output: dedent`
        switch (kind) {
          case "a":
            first()

            second()
            break
          case "b":
            doB()
            log()
            break
          case "c":
            doC()
            break
        }
      `,
      errors: [ { messageId: "preferSwitch" } ]
    },
    // `switch` matches strictly, so loose `==` gets no fix.
    {
      code: dedent`
        if (x == 1) doA()
        else if (x == 2) doB()
        else if (x == 3) doC()
      `,
      output: null,
      errors: [ { messageId: "preferSwitch" } ]
    },
    {
      code: dedent`
        if (this.kind === "a") {
          first()
        } else if (this.kind === "b") {
          second()
        } else if (this.kind === "c") {
          third()
        }
      `,
      output: dedent`
        switch (this.kind) {
          case "a":
            first()
            break
          case "b":
            second()
            break
          case "c":
            third()
            break
        }
      `,
      errors: [ { messageId: "preferSwitch", data: { count: 3, name: "this.kind" } } ]
    },
    {
      code: dedent`
        if (item.type === "a") {
          first()
        } else if (item.type === "b") {
          second()
        } else if (item.type === "c") {
          third()
        }
      `,
      output: dedent`
        switch (item.type) {
          case "a":
            first()
            break
          case "b":
            second()
            break
          case "c":
            third()
            break
        }
      `,
      errors: [ { messageId: "preferSwitch", data: { count: 3, name: "item.type" } } ]
    }
  ]
})
