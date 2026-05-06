import rule from "#rules/no-data-clump"
import { dedent, tester } from "#test/support"

tester.run("no-data-clump", rule, {
  valid: [
    // Fewer functions than the threshold share the pair.
    dedent`
      function area(width, height) {
        return width * height
      }

      function perimeter(width, height) {
        return width + height
      }
    `,
    // Single-letter parameters are not meaningful clumps.
    dedent`
      function add(a, b) {}
      function sub(a, b) {}
      function mul(a, b) {}
    `,
    // The recursion subject is exempt: `node` is passed both itself and derived.
    dedent`
      function walk(node, parent) {
        visit(node, parent)
        walk(node.left, node)
        walk(node.right, node)
      }

      function visit(node, parent) {
        return inspect(node, parent)
      }

      function inspect(node, parent) {
        return node.value
      }
    `,
    // A single parameter shared by only a few functions stays below the higher
    // single-parameter threshold.
    dedent`
      function check(node) { return validate(node) }
      function validate(node) { return node.ok }
      function inspect(node) { return node.kind }
    `,
    // Exported functions are public API: a parameter shared across them is an
    // intentional toolkit signature, not internal threading.
    {
      code: dedent`
        export function check(node) { return node.a }
        export function validate(node) { return node.b }
        export function inspect(node) { return node.c }
      `,
      options: [ { minFunctionsForSingleParam: 3 } ]
    },
    // Public class methods answer to an interface, not internal threading, so a
    // shared parameter across them is not a clump.
    dedent`
      class Box {
        area(width, height) {}
        perimeter(width, height) {}
        diagonal(width, height) {}
      }
    `
  ],
  invalid: [
    // Three top-level functions threading the same pair.
    {
      code: dedent`
        function area(width, height) {
          return width * height
        }

        function perimeter(width, height) {
          return 2 * (width + height)
        }

        function diagonal(width, height) {
          return Math.hypot(width, height)
        }
      `,
      errors: [ { messageId: "parameterClump" } ]
    },
    // Three private class methods sharing the same pair.
    {
      code: dedent`
        class Box {
          #area(width, height) {}
          #perimeter(width, height) {}
          #diagonal(width, height) {}
        }
      `,
      errors: [ { messageId: "parameterClump" } ]
    },
    // A lower threshold flags a pair shared by only two functions.
    {
      code: dedent`
        function area(width, height) {}
        function perimeter(width, height) {}
      `,
      options: [ { minFunctions: 2 } ],
      errors: [ { messageId: "parameterClump" } ]
    },
    // One parameter threaded through enough internal functions is instance state.
    {
      code: dedent`
        function check(node) { return validate(node) }
        function validate(node) { return node.ok }
        function inspect(node) { return node.kind }
      `,
      options: [ { minFunctionsForSingleParam: 3 } ],
      errors: [ { messageId: "parameterClump", data: { count: 3, parameters: "node" } } ]
    },
    // The full shared combination is reported, not just the pair that found it.
    {
      code: dedent`
        function create(name, email, phone) {}
        function validate(name, email, phone) {}
        function persist(name, email, phone) {}
      `,
      errors: [ { messageId: "parameterClump", data: { count: 3, parameters: "email, name, phone" } } ]
    },
    // Names that travel together in varying combinations are still one object,
    // even when no single pair is shared by every function.
    {
      code: dedent`
        function foo(name, kind) {}
        function bar(name, role) {}
        function baz(kind, role) {}
      `,
      errors: [ { messageId: "parameterClump", data: { count: 3, parameters: "kind, name, role" } } ]
    }
  ]
})
