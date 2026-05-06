import rule from "#rules/prefer_class_for_state"
import { dedent, tester } from "#support"

tester.run("prefer-class-for-state", rule, {
  valid: [
    // Built, but threaded through fewer than the threshold.
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
    // A parameter passed to a couple of helpers, below the threshold.
    dedent`
      function walk(node) {
        visit(node)
        descend(node)
      }

      function visit(node) {}
      function descend(node) {}
    `,
    // Built at the top level, but only used as a callback; never passed as an argument, so it is an element type, not
    // threaded state.
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
    // A recursive walk: the value is a moving cursor over a tree, not state, so the flow is not followed through the
    // recursive function. Without that exemption \`child\` would reach own/size/children/count and be flagged.
    dedent`
      function count(node) {
        return own(node) + size(node) + children(node).reduce((total, child) => total + count(child), 0)
      }

      function own(node) {}
      function size(node) {}
      function children(node) {}
    `,
    // Mutual recursion is also a cursor, not state: \`node\` flows into the \`containsExit\`/\`hasNestedExit\` cycle,
    // which descends the tree. Without the mutual-recursion exemption it would reach four functions and be flagged.
    dedent`
      function containsExit(node) {
        return isExit(node) || hasNestedExit(node)
      }

      function hasNestedExit(node) {
        return children(node).some((child) => containsExit(child))
      }

      function isExit(node) {}
      function children(node) {}
    `
  ],
  invalid: [
    // Built once, then passed as an argument to four functions: instance state.
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
    // A parameter threaded through four helpers wants to be the class they share.
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
    // An iteration variable passed to every operation in the loop body: the body wants to be a class wrapping the item.
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
    // Threaded down a pipeline: each function passes the value to just one more, so no single hop reaches the
    // threshold, but the value flows through four.
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
