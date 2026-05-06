import rule from "#rules/no-data-clump"
import { dedent, tester } from "#support"

tester.run("no-data-clump", rule, {
  valid: [
    // Two functions sharing a core, each with an extra of its own: the names may merely have met, so this waits for a
    // third function.
    dedent`
      function area(width, height, unit) {
        return width * height
      }

      function perimeter(width, height, precision) {
        return width + height
      }
    `,
    // Two functions sharing a single name stay far below the single-name reach.
    dedent`
      function area(width, unit) {
        return width * width
      }

      function label(width, suffix) {
        return width + suffix
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
    // The subject moves through the parameter list instead: `walk(child, node)` hands `node` on as the next `parent`,
    // so it is a new value at every step even though no argument is written as a member of it.
    dedent`
      function walk(node, parent) {
        childrenOf(node).forEach((child) => walk(child, node))
        return check(node, parent)
      }

      function check(node, parent) {
        return node === parent
      }
    `,
    // The same shift, inside a class and through a private method.
    dedent`
      class Scan {
        #found = []

        #walk(node, parent) {
          if (this.#isReference(node, parent)) this.#found.push(node)
          childrenOf(node).forEach((child) => this.#walk(child, node))
        }

        #isReference(node, parent) {
          return Boolean(node) && Boolean(parent)
        }
      }
    `,
    // A single parameter shared by only a few functions stays below the higher single-parameter threshold.
    dedent`
      function check(node) { return validate(node) }
      function validate(node) { return node.ok }
      function inspect(node) { return node.kind }
    `,
    // Exported functions are public API: a parameter shared across them is an intentional toolkit signature, not
    // internal threading.
    {
      code: dedent`
        export function check(node) { return node.a }
        export function validate(node) { return node.b }
        export function inspect(node) { return node.c }
      `,
      options: [ { minFunctionsForSingleParam: 3 } ]
    },
    // Public class methods answer to an interface, not internal threading, so a shared parameter across them is not a
    // clump.
    dedent`
      class Box {
        area(width, height) {}
        perimeter(width, height) {}
        diagonal(width, height) {}
      }
    `,
    // Only one function combines the pair; the other two each receive a single value. A value arriving is not a concept
    // being passed around.
    dedent`
      function one(alpha, beta) { return alpha + beta }
      function two(alpha) { return alpha }
      function three(beta) { return beta }
    `,
    // Two pairs bridged by a shared name, with no function taking three.
    dedent`
      function one(alpha, beta) { return alpha }
      function two(beta, gamma) { return gamma }
      function three(alpha) { return alpha }
      function four(gamma) { return gamma }
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
    // A signature repeated verbatim is telling at two functions already: nothing in those parameter lists explains the
    // co-occurrence but the concept.
    {
      code: dedent`
        function area(width, height) {}
        function perimeter(width, height) {}
      `,
      errors: [ { messageId: "parameterClump", data: { functions: "area, perimeter", parameters: "height, width" } } ]
    },
    // Components partition the shared names, so two of them are two reports.
    {
      code: dedent`
        function area(width, height) {}
        function perimeter(width, height) {}
        function greet(name, email) {}
        function notify(name, email) {}
      `,
      errors: [
        { messageId: "parameterClump", data: { functions: "area, perimeter", parameters: "height, width" } },
        { messageId: "parameterClump", data: { functions: "greet, notify", parameters: "email, name" } }
      ]
    },
    // One parameter threaded through enough internal functions is instance state.
    {
      code: dedent`
        function check(node) { return validate(node) }
        function validate(node) { return node.ok }
        function inspect(node) { return node.kind }
      `,
      options: [ { minFunctionsForSingleParam: 3 } ],
      errors: [ { messageId: "parameterClump", data: { functions: "check, validate, inspect", parameters: "node" } } ]
    },
    // The full shared combination is reported, not just the pair that found it.
    {
      code: dedent`
        function create(name, email, phone) {}
        function validate(name, email, phone) {}
        function persist(name, email, phone) {}
      `,
      errors: [ {
        messageId: "parameterClump",
        data: { functions: "create, validate, persist", parameters: "email, name, phone" }
      } ]
    },
    // Names that travel together in varying combinations are still one object, even when no single pair is shared by
    // every function. Reported as a woven cluster, since no function takes the whole set.
    {
      code: dedent`
        function foo(name, kind) {}
        function bar(name, role) {}
        function baz(kind, role) {}
      `,
      errors: [ {
        messageId: "parameterCluster",
        data: { functions: "foo, bar, baz", parameters: "kind, name, role" }
      } ]
    },
    // Varying combinations and orders, with one function taking all three. Still woven, because not every function
    // takes the whole set.
    {
      code: dedent`
        function one(alpha, beta) {}
        function two(alpha, beta, gamma) {}
        function three(beta, alpha) {}
        function four(alpha, gamma) {}
      `,
      errors: [ {
        messageId: "parameterCluster",
        data: { functions: "one, two, three, four", parameters: "alpha, beta, gamma" }
      } ]
    },
    // Order alone never mattered: the names are compared as a set.
    {
      code: dedent`
        function one(alpha, beta, gamma) {}
        function two(gamma, alpha, beta) {}
        function three(beta, gamma, alpha) {}
      `,
      errors: [ {
        messageId: "parameterClump",
        data: { functions: "one, two, three", parameters: "alpha, beta, gamma" }
      } ]
    }
  ]
})
