import rule from "#rules/prefer_class_for_state"
import { dedent, tester } from "#support"

tester.run("prefer-class-for-state", rule, {
  valid: [
    dedent`
      function run(input) {
        const model = build(input)
        a(model)
        b(model)
      }

      function build(input) {
        return input
      }

      function a(model) {}
      function b(model) {}
    `,
    dedent`
      function walk(node) {
        visit(node)
        descend(node)
      }

      function visit(node) {}
      function descend(node) {}
    `,
    // Passed as callbacks, never as an argument, so `entry` is an element type rather than threaded state.
    dedent`
      function build(rows) {
        return rows.map(toEntry).map(name).filter(active)
      }

      function toEntry(row) {
        const entry = parse(row)
        return entry
      }

      function name(entry) {
        return entry.id
      }

      function active(entry) {
        return entry.on
      }
    `,
    // A recursive walk's value is a cursor over a tree, not state, so the flow is not followed through `count`.
    dedent`
      function count(node) {
        return own(node) + size(node) + children(node).reduce((total, child) => total + count(child), 0)
      }

      function own(node) {}
      function size(node) {}
      function children(node) {}
    `,
    // Mutual recursion is a cursor too, so `node` is not followed through the `containsExit`/`hasNestedExit` cycle.
    dedent`
      function containsExit(node) {
        return isExit(node) || hasNestedExit(node)
      }

      function hasNestedExit(node) {
        return children(node).some((child) => containsExit(child))
      }

      function isExit(node) {}
      function children(node) {}
    `,
    // Two functions sharing a helper, so `input` reaches three functions in all.
    dedent`
      function run(input) {
        first(input)
        second(input)
      }

      function first(input) {
        shared(input)
      }

      function second(input) {
        shared(input)
      }

      function shared(input) {}
    `,
    // Called rather than passed along.
    dedent`
      function run(callback) {
        callback()
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        function run(input) {
          const model = build(input)
          a(model)
          b(model)
          c(model)
          d(model)
        }

        function build(input) {
          return input
        }

        function a(model) {}
        function b(model) {}
        function c(model) {}
        function d(model) {}
      `,
      errors: [ { messageId: "threadedState", data: { name: "model", count: "4" } } ]
    },
    {
      code: dedent`
        function walk(node) {
          visit(node)
          descend(node)
          check(node)
          inspect(node)
        }

        function visit(node) {}
        function descend(node) {}
        function check(node) {}
        function inspect(node) {}
      `,
      errors: [ { messageId: "threadedState", data: { name: "node", count: "4" } } ]
    },
    {
      code: dedent`
        function process(items) {
          items.forEach((raw) => {
            save(raw)
            tag(raw)
            link(raw)
            index(raw)
          })
        }
      `,
      errors: [ { messageId: "threadedState", data: { name: "raw", count: "4" } } ]
    },
    // No single hop reaches the threshold, but the value flows through four functions.
    {
      code: dedent`
        function run(node) {
          stage1(node)
        }

        function stage1(node) { stage2(node) }
        function stage2(node) { stage3(node) }
        function stage3(node) { finish(node) }
        function finish(node) {}
      `,
      errors: [ { messageId: "threadedState", data: { name: "node", count: "4" } } ]
    }
  ]
})
