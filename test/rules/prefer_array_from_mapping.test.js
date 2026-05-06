import rule from "#rules/prefer_array_from_mapping"
import { dedent, tester } from "#support"

tester.run("prefer-array-from-mapping", rule, {
  valid: [
    "Array.from(nodes, (node) => node.name)",
    "Array.from(nodes, (node) => node.name).map((name) => name.trim())",
    "nodes.map((node) => node.name)",
    "Array.of(node).map((node) => node.name)",
    "Array.from(nodes)?.map((node) => node.name)",
    "Array.from(nodes).map()",
    // `flatMap` territory.
    "Array.from(nodes).map((node) => node.children).flat()",
    "Array.from(nodes).map((node) => node.children).flat(1)",
    // A spread of two things, or of one thing among others, is not the iterable itself.
    "[ ...nodes, ...others ].map((node) => node.name)",
    "[ ...nodes, root ].map((node) => node.name)",
    "[ node ].map((node) => node.name)",
    // `Array.from` hands its mapper the element and index, not the array a third parameter or a rest would receive.
    "Array.from(nodes).map(nameOf)",
    "Array.from(nodes).map((node, index, all) => all[index])",
    "[ ...nodes ].map((...args) => args)",
    "function f(Array) { return Array.from(nodes).map((node) => node.name) }",
    "function f(Array) { return [ ...nodes ].map((node) => node.name) }"
  ],
  invalid: [
    {
      code: "Array.from(nodes).map((node) => node.name)",
      output: "Array.from(nodes, (node) => node.name)",
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "[ ...nodes ].map((node) => node.name)",
      output: "Array.from(nodes, (node) => node.name)",
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "[...nodes].map(function (node) { return node.name })",
      output: "Array.from(nodes, function (node) { return node.name })",
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "[ ...nodes ].map((node, index) => [ index, node ])",
      output: "Array.from(nodes, (node, index) => [ index, node ])",
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "[ ...(a || b) ].map((node) => node.name)",
      output: "Array.from((a || b), (node) => node.name)",
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    // `Array.from` takes the `thisArg` too.
    {
      code: "Array.from(nodes).map(function (node) { return this.nameOf(node) }, presenter)",
      output: "Array.from(nodes, function (node) { return this.nameOf(node) }, presenter)",
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    // Only the default depth is `flatMap`.
    {
      code: "Array.from(nodes).map((node) => node.children).flat(2)",
      output: "Array.from(nodes, (node) => node.children).flat(2)",
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: dedent`
        const names = Array.from(nodes)
          .map((node) => node.name)
      `,
      output: "const names = Array.from(nodes, (node) => node.name)",
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    // A comment between the two calls follows the comma, and the line break keeps the callback out of it.
    {
      code: dedent`
        const names = Array.from(nodes) // every node
          .map((node) => node.name)
      `,
      output: dedent`
        const names = Array.from(nodes, // every node
          (node) => node.name)
      `,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "Array.from(nodes) /* every node */ .map((node) => node.name)",
      output: "Array.from(nodes, /* every node */ (node) => node.name)",
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: dedent`
        const names = [ ...nodes ].map((node) => {
          return node.name
        })
      `,
      output: dedent`
        const names = Array.from(nodes, (node) => {
          return node.name
        })
      `,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    }
  ]
})
