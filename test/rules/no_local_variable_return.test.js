import rule from "#rules/no_local_variable_return"
import { tester } from "#support"

tester.run("no-local-variable-return", rule, {
  valid: [
    "function f() { return compute() }",
    "function f(value) { return value }",
    "function f() { const base = 1; return base + 1 }"
  ],
  invalid: [
    {
      code: "function f() { const result = compute(); return result }",
      output: "function f() { return compute() }",
      errors: [ { messageId: "noLocalReturn", data: { name: "result" } } ]
    },
    {
      code: "function f() { let items = []; items.push(1); return items }",
      output: null,
      errors: [ { messageId: "noLocalReturn", data: { name: "items" } } ]
    }
  ]
})
