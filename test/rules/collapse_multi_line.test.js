import rule from "#rules/collapse_multi_line"
import { dedent, tester } from "#support"

tester.run("collapse-multi-line", rule, {
  valid: [
    // `entry => {}` has no parentheses of its own, so the call's must not be mistaken for them.
    dedent`
      items.forEach(entry => {
        const title = entry.target
        const column = title.closest(".cards")
      })
    `,
    "const obj = { a: 1, b: 2 }",
    "const arr = [ 1, 2, 3 ]",
    "const { a, b } = obj",
    "const [ a, b ] = arr",
    "function foo(a, b) {}",
    "foo(a, b)",
    "import { a, b } from 'mod'",
    "export { a, b } from 'mod'",
    dedent`
      export * as data from "mod" with {
        type: "json"
      }
    `,
    "new Foo(a, b)",
    {
      code: dedent`
        foo(
          aLongArgument,
          anotherLongArgument
        )
      `,
      options: [ { maxLength: 20 } ]
    },

    dedent`
      foo(
        a,
        // why b
        b
      )
    `,

    dedent`
      foo((a) => {
        return a + 1
      })
    `,

    dedent`
      reallyLongFunction(
        averyLongArgumentName,
        anotherVeryLongArgumentName,
        andOneMoreVeryLongOneForGoodMeasureToExceedTheLineWidth
      )
    `,

    // A template spanning lines carries those newlines as content, so the list around it keeps its shape.
    "const queries = [\n  `\n    select 1\n  `\n]",
    "const queries = {\n  report: `\n    select 1\n  `\n}",
    "wrap(\n  `\n    hello\n  `\n)",

    // These parens group a `new` callee; they are not an omitted constructor's argument list. Collapsing their contents
    // would turn the line break after `return` into a space and change the method's result.
    dedent`
      const instance = new (
        class {
          value() {
            return
            1
          }
        }
      )
    `,
    { name: "does not scan delimiters repeatedly in deeply nested single-line calls", code: nestedCalls(400) }
  ],
  invalid: [
    // Whitespace inside a string, template or regex is content, not layout.
    {
      code: dedent`
        const messages = [
          "dos   espacios"
        ]
      `,
      output: dedent`
        const messages = ["dos   espacios"]
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: "const spaced = fn(\n  `a  b`\n)",
      output: "const spaced = fn(`a  b`)",
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        const pattern = fn(
          /a  b/u
        )
      `,
      output: dedent`
        const pattern = fn(/a  b/u)
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        const obj = {
          a: 1,
          b: 2
        }
      `,
      output: dedent`
        const obj = { a: 1, b: 2 }
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        const {
          a,
          b
        } = obj
      `,
      output: dedent`
        const { a, b } = obj
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        const arr = [
          1,
          2,
          3
        ]
      `,
      output: dedent`
        const arr = [1, 2, 3]
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        const [
          a,
          b
        ] = arr
      `,
      output: dedent`
        const [a, b] = arr
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        async function loadConversation(
          threadId,
          excludeFolderIds,
          signal
        ) {}
      `,
      output: dedent`
        async function loadConversation(threadId, excludeFolderIds, signal) {}
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        const sum = (
          a,
          b
        ) => a + b
      `,
      output: dedent`
        const sum = (a, b) => a + b
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        class Service {
          async fetch(
            url,
            options
          ) {}
        }
      `,
      output: dedent`
        class Service {
          async fetch(url, options) {}
        }
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        loadConversation(
          threadId,
          excludeFolderIds,
          signal
        )
      `,
      output: dedent`
        loadConversation(threadId, excludeFolderIds, signal)
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        loadConversation(
          (threadId),
          excludeFolderIds
        )
      `,
      output: "loadConversation((threadId), excludeFolderIds)",
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        new Service(
          options,
          context
        )
      `,
      output: dedent`
        new Service(options, context)
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        import {
          foo,
          bar
        } from 'mod'
      `,
      output: dedent`
        import { foo, bar } from 'mod'
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        import defaultThing, {
          foo,
          bar
        } from 'mod'
      `,
      output: dedent`
        import defaultThing, { foo, bar } from 'mod'
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        import {
          foo,
          bar
        } from "mod" with { type: "json" }
      `,
      output: "import { foo, bar } from \"mod\" with { type: \"json\" }",
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        export {
          foo,
          bar
        } from 'mod'
      `,
      output: dedent`
        export { foo, bar } from 'mod'
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        export {
          foo,
          bar
        } from "mod" with { type: "json" }
      `,
      output: "export { foo, bar } from \"mod\" with { type: \"json\" }",
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        function noParams(
        ) {}
      `,
      output: dedent`
        function noParams() {}
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    },
    {
      code: dedent`
        foo({
          x: 1,
          y: 2
        })
      `,
      output: dedent`
        foo({ x: 1, y: 2 })
      `,
      errors: [ { messageId: "collapseMultiLine" } ]
    }
  ]
})

function nestedCalls(depth) {
  return `const value = ${"call(".repeat(depth)}0${")".repeat(depth)}`
}
