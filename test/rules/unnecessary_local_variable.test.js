import rule from "#rules/unnecessary_local_variable"
import { dedent, tester } from "#support"

tester.run("unnecessary-local-variable", rule, {
  valid: [
    // Read more than once.
    "function f() { const user = find(); user.activate(); return user.id }",
    // Read inside a nested callback (accumulator or re-evaluation guard).
    "function f() { const cached = compute(); return list.map((item) => use(cached, item)) }",
    // Initializer is not a call or member access.
    "function f() { const total = 0; return total + 1 }",
    // Module-level constant (not inside a method).
    "const config = build(); export default config",
    // Snapshot read only to restore state in a `finally`.
    "function f() { const previous = snapshot(); try { run() } finally { restore(previous) } }"
  ],
  invalid: [
    // Where the statement starts, the object literal would parse as a block, so the value is parenthesized.
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
    // With a statement above it, those parentheses would continue that line instead: reported, unfixed.
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
    // Read once, but not in the next statement: reported, inlining left to a human.
    {
      code: "function f() { const directory = forbiddenDirectory(); log(); return Boolean(directory) }",
      output: null,
      errors: [ { messageId: "unnecessaryLocal", data: { name: "directory" } } ]
    },
    // A shorthand property is its own key, so the whole property is rewritten and the key survives.
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
    // The alias goes, the comment explaining it stays.
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
    }
  ]
})
