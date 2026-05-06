import rule from "#rules/collapse-multi-line"
import { dedent, tester } from "#test/support"

tester.run("collapse-multi-line", rule, {
  valid: [
    // Already single-line.
    "const obj = { a: 1, b: 2 }",
    "const arr = [ 1, 2, 3 ]",
    "const { a, b } = obj",
    "const [ a, b ] = arr",
    "function foo(a, b) {}",
    "foo(a, b)",
    "import { a, b } from 'mod'",
    "export { a, b } from 'mod'",
    "new Foo(a, b)",
    // A lower `maxLength` leaves wider collapses alone.
    {
      code: dedent`
        foo(
          aLongArgument,
          anotherLongArgument
        )
      `,
      options: [ { maxLength: 20 } ]
    },

    // Skip when inner contains a comment.
    dedent`
      foo(
        a,
        // why b
        b
      )
    `,

    // Skip when a function callback arg has a multi-line body. The arrow's
    // own params are single-line so its own visitor doesn't fire either.
    dedent`
      foo((a) => {
        return a + 1
      })
    `,

    // Multi-line where projected length really exceeds 120.
    dedent`
      reallyLongFunction(
        averyLongArgumentName,
        anotherVeryLongArgumentName,
        andOneMoreVeryLongOneForGoodMeasureToExceedTheLineWidth
      )
    `
  ],
  invalid: [
    // Object literal.
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
    // Object destructuring.
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
    // Array literal.
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
    // Array destructuring.
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
    // Function params.
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
    // Arrow params.
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
    // Method params.
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
    // Call expression.
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
    // New expression.
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
    // Named imports.
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
    // Named imports with default specifier (still works).
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
    // Named exports.
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
    // Empty parens that span lines.
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
    // Object inside a call: only the inner object fires; the collapse brings
    // the whole construct to one line.
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
