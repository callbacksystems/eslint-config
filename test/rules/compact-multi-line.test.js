import rule from "#rules/compact-multi-line"
import { dedent, tester } from "#test/support"

tester.run("compact-multi-line", rule, {
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
      errors: [ { messageId: "compactMultiLine" } ]
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
      errors: [ { messageId: "compactMultiLine" } ]
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
      errors: [ { messageId: "compactMultiLine" } ]
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
      errors: [ { messageId: "compactMultiLine" } ]
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
      errors: [ { messageId: "compactMultiLine" } ]
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
      errors: [ { messageId: "compactMultiLine" } ]
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
      errors: [ { messageId: "compactMultiLine" } ]
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
      errors: [ { messageId: "compactMultiLine" } ]
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
      errors: [ { messageId: "compactMultiLine" } ]
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
      errors: [ { messageId: "compactMultiLine" } ]
    },
    // Named imports with default specifier — still works.
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
      errors: [ { messageId: "compactMultiLine" } ]
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
      errors: [ { messageId: "compactMultiLine" } ]
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
      errors: [ { messageId: "compactMultiLine" } ]
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
      errors: [ { messageId: "compactMultiLine" } ]
    }
  ]
})
