import rule from "#rules/no_data_clump"
import { dedent, tester } from "#support"

tester.run("no-data-clump", rule, {
  valid: [
    // A shared core with extras of its own may be coincidence, so this waits for a third function.
    dedent`
      function area(width, height, unit) {
        return width * height
      }

      function perimeter(width, height, precision) {
        return width + height
      }
    `,
    dedent`
      function area(width, unit) {
        return width * width
      }

      function label(width, suffix) {
        return width + suffix
      }
    `,
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
    // `walk(child, node)` hands `node` on as the next `parent`, so it is a new value at every step.
    dedent`
      function walk(node, parent) {
        childrenOf(node).forEach((child) => walk(child, node))
        return check(node, parent)
      }

      function check(node, parent) {
        return node === parent
      }
    `,
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
    dedent`
      function check(node) { return validate(node) }
      function validate(node) { return node.ok }
      function inspect(node) { return node.kind }
    `,
    {
      code: dedent`
        export function check(node) { return node.a }
        export function validate(node) { return node.b }
        export function inspect(node) { return node.c }
      `,
      options: [ { minFunctionsForSingleParam: 3 } ]
    },
    dedent`
      class Box {
        area(width, height) {}
        perimeter(width, height) {}
        diagonal(width, height) {}
      }
    `,
    dedent`
      function one(alpha, beta) { return alpha + beta }
      function two(alpha) { return alpha }
      function three(beta) { return beta }
    `,
    // An array pattern names no parameter of its own.
    dedent`
      function first([ head ], fallback) { return head ?? fallback }
      function second([ head ], fallback) { return head ?? fallback }
    `,
    dedent`
      function one(alpha, beta) { return alpha }
      function two(beta, gamma) { return gamma }
      function three(alpha) { return alpha }
      function four(gamma) { return gamma }
    `
  ],
  invalid: [
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
    // A signature repeated verbatim is telling at two functions already.
    {
      code: dedent`
        function area(width, height) {}
        function perimeter(width, height) {}
      `,
      errors: [ { messageId: "parameterClump", data: { functions: "area, perimeter", parameters: "height, width" } } ]
    },
    // A default, a destructured object and a rest element all name what travels.
    {
      code: dedent`
        function area(width, height = 1) {}
        function perimeter(width, height) {}
      `,
      errors: [ { messageId: "parameterClump", data: { functions: "area, perimeter", parameters: "height, width" } } ]
    },
    {
      code: dedent`
        function greet({ name, email }) {}
        function notify({ name, email }) {}
      `,
      errors: [ { messageId: "parameterClump", data: { functions: "greet, notify", parameters: "email, name" } } ]
    },
    {
      code: dedent`
        function sum(base, ...values) {}
        function product(base, ...values) {}
      `,
      errors: [ { messageId: "parameterClump", data: { functions: "sum, product", parameters: "base, values" } } ]
    },
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
    {
      code: dedent`
        function check(node) { return validate(node) }
        function validate(node) { return node.ok }
        function inspect(node) { return node.kind }
      `,
      options: [ { minFunctionsForSingleParam: 3 } ],
      errors: [ { messageId: "parameterClump", data: { functions: "check, validate, inspect", parameters: "node" } } ]
    },
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
