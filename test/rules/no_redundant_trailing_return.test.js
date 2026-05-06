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
    `,
    dedent`
      function f() {
        doSomething()
        return null
      }
    `,
    dedent`
      function f(undefined) {
        doSomething()
        return undefined
      }
    `,
    dedent`
      function f() {
        const values = items.map((item) => { return item.value })
        return null
      }
    `,
    // A sloppy direct eval can create a local binding that changes what the spelling `undefined` returns.
    { code: 'function f() { eval("var undefined = 1"); return undefined }', languageOptions: { sourceType: "script" } },
    // A read inside `with` can come from the object rather than the global `undefined` binding.
    {
      code: dedent`
        function f(object, flag) {
          with (object) {
            if (flag) return undefined
          }
          work()
          return
        }
      `,
      languageOptions: { sourceType: "script" }
    }
  ],
  invalid: [
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
    },
    // Removing around a comment inside the return would strand unmatched grouping tokens.
    {
      code: dedent`
        function f() {
          doSomething()
          return (/* keep */ undefined)
        }
      `,
      output: null,
      errors: [ { messageId: "redundantTrailingReturn" } ]
    },
    // A trailing prose comment survives on its own line rather than moving onto the statement above it.
    {
      code: dedent`
        function f() {
          doSomething()
          return undefined // explicitly no result
        }
      `,
      output: dedent`
        function f() {
          doSomething()
          // explicitly no result
        }
      `,
      errors: [ { messageId: "redundantTrailingReturn" } ]
    },
    // Removing the return must not retarget a coverage directive to an enclosing or following statement.
    {
      code: dedent`
        function f() {
          doSomething()
          /* istanbul ignore next */
          return undefined
        }
      `,
      output: null,
      errors: [ { messageId: "redundantTrailingReturn" } ]
    }
  ]
})
