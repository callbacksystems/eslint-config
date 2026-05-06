import rule from "#rules/no_local_variable_return"
import { dedent, tester } from "#support"

tester.run("no-local-variable-return", rule, {
  valid: [
    "function f() { return compute() }",
    "function f(value) { return value }",
    "function f() { const base = 1; return base + 1 }"
  ],
  invalid: [
    {
      code: dedent`
        function f() {
          /* istanbul ignore next */
          const value = compute()
          return value
        }
      `,
      output: null,
      errors: [ { messageId: "noLocalReturn" } ]
    },
    {
      code: dedent`
        function f() {
          const value = compute() // eslint-disable-next-line no-undef
          return value
        }
      `,
      output: null,
      errors: [ { messageId: "noLocalReturn" } ]
    },
    {
      code: "function f() { const result = compute(); return result }",
      output: "function f() { return compute() }",
      errors: [ { messageId: "noLocalReturn", data: { name: "result" } } ]
    },
    {
      code: "function f() { using resource = acquire(); return resource }",
      output: null,
      errors: [ { messageId: "noLocalReturn", data: { name: "resource" } } ]
    },
    {
      code: "async function f() { await using resource = acquire(); return resource }",
      output: null,
      errors: [ { messageId: "noLocalReturn", data: { name: "resource" } } ]
    },
    {
      name: "does not remove a binding observable through direct eval",
      code: `function f() {
        var result = 1
        saved = eval("() => result")
        var result = compute()
        return result
      }`,
      output: null,
      errors: [ { messageId: "noLocalReturn", data: { name: "result" } } ]
    },
    {
      code: "function f() { let items = []; items.push(1); return items }",
      output: null,
      errors: [ { messageId: "noLocalReturn", data: { name: "items" } } ]
    },
    {
      code: "function f() { if (ready) { var result = compute() } return result }",
      output: null,
      errors: [ { messageId: "noLocalReturn", data: { name: "result" } } ]
    },
    {
      code: dedent`
        function f() {
          const result = compute(/* kept inside */ value)
          // Kept between.
          return result // Kept after.
        }
      `,
      output: dedent`
        function f() {
          // Kept between.
          return compute(/* kept inside */ value) // Kept after.
        }
      `,
      errors: [ { messageId: "noLocalReturn", data: { name: "result" } } ]
    }
  ]
})
