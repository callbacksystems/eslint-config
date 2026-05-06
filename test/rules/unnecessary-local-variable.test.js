import rule from "#rules/unnecessary-local-variable"
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
