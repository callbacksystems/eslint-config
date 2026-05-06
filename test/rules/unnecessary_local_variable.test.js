import rule from "#rules/unnecessary_local_variable"
import { dedent, tester } from "#support"

tester.run("unnecessary-local-variable", rule, {
  valid: [
    "function f() { const user = find(); user.activate(); return user.id }",
    // Inlining into the callback would re-evaluate `compute()` per item.
    "function f() { const cached = compute(); return list.map((item) => use(cached, item)) }",
    "function f() { const total = 0; return total + 1 }",
    "const config = build(); export default config",
    // A snapshot restored in `finally` has to be taken before the `try`.
    "function f() { const previous = snapshot(); try { run() } finally { restore(previous) } }"
  ],
  invalid: [
    // At the start of a statement the object literal would parse as a block, so it is parenthesized.
    {
      code: dedent`
        function f() {
          const action = { ready: 1 }[state]
          action()
        }
      `,
      output: dedent`
        function f() {
          ({ ready: 1 }[state])()
        }
      `,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "action" } } ]
    },
    // Below another statement, those parentheses would continue its line, so no fix.
    {
      code: dedent`
        function f() {
          work()
          const action = { ready: 1 }[state]
          action()
        }
      `,
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "action" } } ]
    },
    {
      code: "function f() { const directory = forbiddenDirectory(); return Boolean(directory) }",
      output: "function f() { return Boolean(forbiddenDirectory()) }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "directory" } } ]
    },
    {
      code: "function f() { const account = user.account; account.charge() }",
      output: "function f() { user.account.charge() }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "account" } } ]
    },
    {
      code: "function f() { const directory = forbiddenDirectory(); log(); return Boolean(directory) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "directory" } } ]
    },
    {
      code: "function f() { const summary = expectedSummary(); return { summary } }",
      output: "function f() { return { summary: expectedSummary() } }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "summary" } } ]
    },
    {
      code: "function f() { const items = list.all; return { items, total: 1 } }",
      output: "function f() { return { items: list.all, total: 1 } }",
      errors: [ { messageId: "unnecessaryLocal", data: { name: "items" } } ]
    },
    {
      code: dedent`
        function f() {
          const value = compute()
          // explains the call
          return use(value)
        }
      `,
      output: dedent`
        function f() {
          // explains the call
          return use(compute())
        }
      `,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "value" } } ]
    },
    // A declaration outside a block has no next statement to inline into, so no fix.
    {
      code: dedent`
        function f(state) {
          switch (state) {
            case "ready":
              const action = build()
              return run(action)
          }
        }
      `,
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "action" } } ]
    }
  ]
})
