import rule from "#rules/prefer_switch_over_if_chain"
import { dedent, tester } from "#support"

const BACKTICK = "`"

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
        const kind = currentKind
        if (kind === "a") doA() // first
        // Second.
        else if (kind === "b") doB()
        else if (kind === "c") doC()
      `,
      output: dedent`
        const kind = currentKind
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
        const kind = currentKind
        if (kind === "a") { // first
          use(first())
        } else if (kind === "b") {
          use(second())
        } else if (kind === "c") {
          use(third())
        }
      `,
      output: dedent`
        const kind = currentKind
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
        const kind = currentKind
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
        const kind = currentKind
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
        const kind = currentKind
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
        const kind = currentKind
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
        const kind = currentKind
        if (kind === "a") doA()
        else if (kind === "b") doB()
        else if (kind === "c") doC()
      `,
      output: dedent`
        const kind = currentKind
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
        const kind = currentKind
        if (kind === "a") doA()
        else if (kind === "b") doB()
      `,
      output: dedent`
        const kind = currentKind
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
        const action = currentAction
        if (action === 1) handle1()
        else if (action === 2) handle2()
        else if (action === 3) handle3()
        else handleDefault()
      `,
      output: dedent`
        const action = currentAction
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
        const kind = currentKind
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
        const kind = currentKind
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
      output: null,
      errors: [ { messageId: "preferSwitch" } ]
    },
    // A blank line inside a body stays blank, and an over-indented body comes out at the case's own indent.
    {
      code: dedent`
        const kind = currentKind
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
        const kind = currentKind
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
      output: null,
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
      output: null,
      errors: [ { messageId: "preferSwitch", data: { count: 3, name: "item.type" } } ]
    },
    {
      code: dedent`
        const kind = currentKind
        if (kind === nextKind()) doA()
        else if (kind === fallbackKind()) doB()
        else if (kind === finalKind()) doC()
      `,
      output: null,
      errors: [ { messageId: "preferSwitch", data: { count: 3, name: "kind" } } ]
    },
    // Reindenting a multi-line literal would change its value, so this remains report-only.
    {
      code: dedent`
        const kind = currentKind
        if (kind === "a") {
          use(${BACKTICK}first
        value${BACKTICK})
        } else if (kind === "b") {
          use(${BACKTICK}second
        value${BACKTICK})
        } else if (kind === "c") {
          use(${BACKTICK}third
        value${BACKTICK})
        }
      `,
      output: null,
      errors: [ { messageId: "preferSwitch" } ]
    },
    {
      code: "const kind = currentKind\r\nif (kind === 1) first()\r\nelse if (kind === 2) second()"
        + "\r\nelse if (kind === 3) third()",
      output: "const kind = currentKind\r\nswitch (kind) {\r\n  case 1:\r\n    first()\r\n    break"
        + "\r\n  case 2:\r\n    second()"
        + "\r\n    break\r\n  case 3:\r\n    third()\r\n    break\r\n}",
      errors: [ { messageId: "preferSwitch" } ]
    },
    // A trailing comment on the final branch remains beside that branch, not beside the generated switch.
    {
      code: dedent`
        const kind = currentKind
        if (kind === "a") first()
        else if (kind === "b") second()
        else if (kind === "c") third() // third branch
      `,
      output: dedent`
        const kind = currentKind
        switch (kind) {
          case "a":
            first()
            break
          case "b":
            second()
            break
          case "c":
            third() // third branch
            break
        }
      `,
      errors: [ { messageId: "preferSwitch" } ]
    },
    // An unresolved/global identifier can be an accessor, so repeated reads cannot be collapsed into one safely.
    {
      code: dedent`
        if (kind === "a") first()
        else if (kind === "b") second()
        else if (kind === "c") third()
      `,
      output: null,
      errors: [ { messageId: "preferSwitch" } ]
    },
    // `with` can replace a lexical-looking name with an accessor from its object environment.
    {
      code: dedent`
        let kind = initial
        with (object) {
          if (kind === "a") first()
          else if (kind === "b") second()
          else if (kind === "c") third()
        }
      `,
      output: null,
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "preferSwitch" } ]
    },
    // Annex B function declarations nested under a label still need a case-local block in sloppy scripts.
    {
      code: dedent`
        let kind = initial
        if (kind === "a") { label: function found() { return "a" } }
        else if (kind === "b") { label: function found() { return "b" } }
        else if (kind === "c") { label: function found() { return "c" } }
        result = found()
      `,
      output: dedent`
        let kind = initial
        switch (kind) {
          case "a": {
            label: function found() { return "a" }
            break
          }
          case "b": {
            label: function found() { return "b" }
            break
          }
          case "c": {
            label: function found() { return "c" }
            break
          }
        }
        result = found()
      `,
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "preferSwitch" } ]
    },
    // A next-line directive after the chain belongs to the following statement, not to a generated `break`.
    {
      code: dedent`
        const kind = currentKind
        if (kind === "a") first()
        else if (kind === "b") second()
        else if (kind === "c") third() // eslint-disable-next-line no-undef
        hiddenGlobal()
      `,
      output: null,
      errors: [ { messageId: "preferSwitch" } ]
    },
    // Coverage directives describe an `if` branch and cannot be carried onto a `switch` with the same meaning.
    {
      code: dedent`
        const kind = currentKind
        /* istanbul ignore else */
        if (kind === 1) first()
        else if (kind === 2) second()
        else if (kind === 3) third()
      `,
      output: null,
      errors: [ { messageId: "preferSwitch" } ]
    },
    // A classic-script global `var` may be backed by a host accessor, so collapsing its reads is unsafe.
    {
      code: dedent`
        var kind
        if (kind === 1) first()
        else if (kind === 2) second()
        else if (kind === 3) third()
      `,
      output: null,
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "preferSwitch" } ]
    },
    {
      code: "let kind\nif (kind === 1) first()\nelse if (kind === 2) second()\nelse if (kind === 3) third()",
      output: "let kind\nswitch (kind) {\n  case 1:\n    first()\n    break\n  case 2:\n    second()"
        + "\n    break\n  case 3:\n    third()\n    break\n}",
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "preferSwitch" } ]
    },
    // Accessing `this` before `super()` may enter the catch and complete the case, so the break is required.
    {
      code: dedent`
        class Child extends Parent {
          constructor(kind) {
            if (kind === 1) {
              try { return this } catch {}
            } else if (kind === 2) {
              return {}
            } else if (kind === 3) {
              return {}
            }
          }
        }
      `,
      output: dedent`
        class Child extends Parent {
          constructor(kind) {
            switch (kind) {
              case 1:
                try { return this } catch {}
                break
              case 2:
                return {}
              case 3:
                return {}
            }
          }
        }
      `,
      errors: [ { messageId: "preferSwitch" } ]
    },
    // An abrupt branch already leaves the case; adding `break` after it would create unreachable code.
    {
      code: dedent`
        outer: for (const item of items) {
          const kind = item.kind
          if (kind === 1) continue
          else if (kind === 2) continue outer
          else if (kind === 3) throw Error()
        }
      `,
      output: dedent`
        outer: for (const item of items) {
          const kind = item.kind
          switch (kind) {
            case 1:
              continue
            case 2:
              continue outer
            case 3:
              throw Error()
          }
        }
      `,
      errors: [ { messageId: "preferSwitch" } ]
    },
    // A break owned by a consequent that is itself a loop still belongs to that loop.
    {
      code: dedent`
        let kind
        while (outer) {
          if (kind === 1) while (inner) break
          else if (kind === 2) second()
          else if (kind === 3) third()
        }
      `,
      output: dedent`
        let kind
        while (outer) {
          switch (kind) {
            case 1:
              while (inner) break
              break
            case 2:
              second()
              break
            case 3:
              third()
              break
          }
        }
      `,
      errors: [ { messageId: "preferSwitch" } ]
    },
    { name: "indexes protected breaks once at depth", code: protectedBreaksAt(300), output: null, errors: 1 }
  ]
})

function protectedBreaksAt(depth) {
  return "let kind; while (outer) { /* istanbul ignore next */ if (kind === 1) { while (inner) { "
    + `${"{".repeat(depth)} ${Array.from({ length: depth }, () => "break").join(";")} `
    + `${"}".repeat(depth)} } } else if (kind === 2) second(); else if (kind === 3) third() }`
}
