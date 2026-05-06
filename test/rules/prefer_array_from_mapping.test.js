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
    "Array.from(nodes).map((node) => node.children).flat(1.9)",
    "Array.from(nodes).map((node) => node.children).flat(0x1)",
    "Array.from(nodes)[\"map\"]((node) => node.children)[\"flat\"]()",
    // A spread of two things, or of one thing among others, is not the iterable itself.
    "[ ...nodes, ...others ].map((node) => node.name)",
    "[ ...nodes, root ].map((node) => node.name)",
    "[ node ].map((node) => node.name)",
    // `Array.from` hands its mapper the element and index, not the array a third parameter or a rest would receive.
    "Array.from(nodes).map(nameOf)",
    "Array.from(nodes).map((node, index, all) => all[index])",
    "[ ...nodes ].map((...args) => args)",
    "Array.from(nodes).map(function (node) { return arguments.length })",
    "Array.from(nodes).map(function (node) { return (() => arguments[2])() })",
    "Array.from(nodes).map(function (node) { return eval('arguments.length') })",
    "function f(Array) { return Array.from(nodes).map((node) => node.name) }",
    "function f(Array) { return [ ...nodes ].map((node) => node.name) }",
    { name: "shares a deep shadowed-scope lookup", code: shadowedMappingsAt(80, 80) },
    "Array = Replacement; Array.from(nodes).map((node) => node.name)",
    "Array = Replacement; [ ...nodes ].map((node) => node.name)",
    "class C { #map() {} collect() { return Array.from(nodes).#map((node) => node.name) } }"
  ],
  invalid: [
    {
      code: "Array.from([ first, second ]).map((node) => node.name)",
      output: "Array.from([ first, second ], (node) => node.name)",
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "Array.from([ first, , third ]).map((node) => node.name)",
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "Array.from([ first, second ]).map((node) => node.name, observer())",
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "Array.from([ first, second ]) /* every node */ .map((node) => node.name)",
      output: "Array.from([ first, second ], /* every node */ (node) => node.name)",
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: dedent`
        const names = Array.from([ first, second ]) // every node
          .map((node) => node.name)
      `,
      output: dedent`
        const names = Array.from([ first, second ], // every node
          (node) => node.name)
      `,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: dedent`
        /* istanbul ignore next */
        Array.from([ first, second ]).map((node) => node.name)
      `,
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: dedent`
        Array.from([ first, second ]) // eslint-disable-next-line no-undef
          .map((node) => hidden(node))
      `,
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "Array.from(nodes).map((node) => node.name)",
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "Array[\"from\"]([ first, second ])[\"map\"]((node) => node.name)",
      output: "Array[\"from\"]([ first, second ], (node) => node.name)",
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "[ ...nodes ].map((node) => node.name)",
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "[...nodes].map(function (node) { return node.name })",
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "Array.from(nodes).map(function (node) { return function () { return arguments[0] }() })",
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "Array.from(nodes).map(function (node) { return object.arguments || node })",
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "eval('unrelated'); Array.from(nodes).map(function (node) { return node.name })",
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "[ ...nodes ].map((node, index) => [ index, node ])",
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "[ ...(a || b) ].map((node) => node.name)",
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    // `Array.from` takes the `thisArg` too.
    {
      code: "Array.from(nodes).map(function (node) { return this.nameOf(node) }, presenter)",
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    // Only the default depth is `flatMap`.
    {
      code: "Array.from(nodes).map((node) => node.children).flat(2)",
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: dedent`
        const names = Array.from(nodes)
          .map((node) => node.name)
      `,
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    // A comment between the two calls follows the comma, and the line break keeps the callback out of it.
    {
      code: dedent`
        const names = Array.from(nodes) // every node
          .map((node) => node.name)
      `,
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: "Array.from(nodes) /* every node */ .map((node) => node.name)",
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    },
    {
      code: dedent`
        const names = [ ...nodes ].map((node) => {
          return node.name
        })
      `,
      output: null,
      errors: [ { messageId: "preferArrayFromMapping" } ]
    }
  ]
})

function shadowedMappingsAt(depth, count) {
  return `function collect(Array) { ${blocksAt(depth)}${mappingsAt(count)}${"}".repeat(depth)} }`
}

function blocksAt(depth) {
  return Array.from({ length: depth }, (_, index) => `{ let marker${index} = ${index}; `).join("")
}

function mappingsAt(count) {
  return Array.from({ length: count }, () => "Array.from(nodes).map((node) => node.name)").join(";")
}
