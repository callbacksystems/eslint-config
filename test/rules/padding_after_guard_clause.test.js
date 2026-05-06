import rule from "#rules/padding_after_guard_clause"
import { dedent, tester } from "#support"

tester.run("padding-after-guard-clause", rule, {
  valid: [
    dedent`
      function f(x) {
        if (!x) return

        doSomething()
      }
    `,
    dedent`
      function f(x, y) {
        if (!x) return
        if (!y) return

        doSomething()
      }
    `,
    dedent`
      function f(x) {
        if (!x) return
      }
    `,
    dedent`
      function f(x) {
        if (!x) throw new Error("missing x")

        doSomething()
      }
    `,
    dedent`
      function process(items) {
        for (const item of items) {
          if (item.skip) continue

          handle(item)
        }
      }
    `,
    dedent`
      function classify(kind) {
        switch (kind) {
          case "a":
            if (!ready) return

            doA()
            break
        }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        function f(x) {
          if (!x) return
          doSomething()
        }
      `,
      output: dedent`
        function f(x) {
          if (!x) return

          doSomething()
        }
      `,
      errors: [ { messageId: "expectedBlankLine" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (!x) throw new Error("missing x")
          doSomething()
        }
      `,
      output: dedent`
        function f(x) {
          if (!x) throw new Error("missing x")

          doSomething()
        }
      `,
      errors: [ { messageId: "expectedBlankLine" } ]
    },
    {
      code: dedent`
        function f(items) {
          if (items.length === 0) return
          for (const item of items) handle(item)
        }
      `,
      output: dedent`
        function f(items) {
          if (items.length === 0) return

          for (const item of items) handle(item)
        }
      `,
      errors: [ { messageId: "expectedBlankLine" } ]
    },
    {
      code: dedent`
        function process(items) {
          for (const item of items) {
            if (item.skip) continue
            handle(item)
          }
        }
      `,
      output: dedent`
        function process(items) {
          for (const item of items) {
            if (item.skip) continue

            handle(item)
          }
        }
      `,
      errors: [ { messageId: "expectedBlankLine" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (!x) return // invalid input
          doSomething()
        }
      `,
      output: dedent`
        function f(x) {
          if (!x) return // invalid input

          doSomething()
        }
      `,
      errors: [ { messageId: "expectedBlankLine" } ]
    }
  ]
})
