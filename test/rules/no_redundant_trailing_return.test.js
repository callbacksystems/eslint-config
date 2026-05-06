import rule from "#rules/no_redundant_trailing_return"
import { dedent, tester } from "#support"

tester.run("no-redundant-trailing-return", rule, {
  valid: [
    dedent`
      function f(x) {
        if (x) return 1
        return 2
      }
    `,
    dedent`
      function f() {
        doSomething()
      }
    `,
    dedent`
      function f(x) {
        if (x) return "value"
        return null
      }
    `,
    dedent`
      function first(items) {
        for (const item of items) {
          if (item.ok) return item
        }
        return null
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        function f() {
          doSomething()
          return null
        }
      `,
      output: dedent`
        function f() {
          doSomething()
        }
      `,
      errors: [ { messageId: "redundantTrailingReturn" } ]
    },
    {
      code: dedent`
        function f() {
          doSomething()
          return undefined
        }
      `,
      output: dedent`
        function f() {
          doSomething()
        }
      `,
      errors: [ { messageId: "redundantTrailingReturn" } ]
    },
    // A nested function returning a value says nothing about this one.
    {
      code: dedent`
        function f() {
          const values = items.map((item) => { return item.value })
          return null
        }
      `,
      output: dedent`
        function f() {
          const values = items.map((item) => { return item.value })
        }
      `,
      errors: [ { messageId: "redundantTrailingReturn" } ]
    },
    {
      code: dedent`
        function f() {
          doSomething()
          return
        }
      `,
      output: dedent`
        function f() {
          doSomething()
        }
      `,
      errors: [ { messageId: "redundantTrailingReturn" } ]
    }
  ]
})
