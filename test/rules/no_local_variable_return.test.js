import rule from "#rules/no_local_variable_return"
import { tester } from "#support"

tester.run("no-local-variable-return", rule, {
  valid: [
    "function f() { return compute() }",
    // Returns a parameter, not a local.
    "function f(value) { return value }",
    // Returns an expression that uses a local, not the bare local.
    "function f() { const base = 1; return base + 1 }"
  ],
  invalid: [
    {
      code: "function f() { const result = compute(); return result }",
      output: "function f() { return compute() }",
      errors: [ { messageId: "noLocalReturn", data: { name: "result" } } ]
    },
    // Not adjacent / read more than once: reported, but inlining is left to a human.
    {
      code: "function f() { let items = []; items.push(1); return items }",
      output: null,
      errors: [ { messageId: "noLocalReturn", data: { name: "items" } } ]
    }
  ]
})
