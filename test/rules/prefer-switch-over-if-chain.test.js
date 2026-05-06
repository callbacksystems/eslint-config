import rule from "#rules/prefer-switch-over-if-chain"
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
    // Cases share one scope: a branch declaring a binding keeps its braces, or the second `const result` would be a
    // redeclaration and would not parse.
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
    // Each branch carries its own comments across.
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
    // A lower `min` flags shorter chains.
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
    // Loose `==`: reported, but not auto-converted (switch matches strictly).
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
