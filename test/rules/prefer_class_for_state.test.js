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
    dedent`
      function walk(node) {
        inspect(node)
        compare(node)
        visit(node)
        index(node)
        walk(node.child)
      }

      function inspect(node) {}
      function compare(node) {}
      function visit(node) {}
      function index(node) {}
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
    `,
    dedent`
      function run(model) { stage(model) }
      function stage(...models) { finish(models) }
      function finish(models) { return models }
    `,
    dedent`
      function run(model) {
        first(model)
        model = replacement
        second(model)
        third(model)
        fourth(model)
      }
    `,
    dedent`
      function run(node) {
        class RecursiveNow { static value = run(node.child) }
        stage1(node)
      }
      function stage1(node) { stage2(node) }
      function stage2(node) { stage3(node) }
      function stage3(node) { finish(node) }
      function finish(node) {}
    `,
    // The nested `stage` is a different binding and cannot receive `input` from the top-level call.
    dedent`
      function run(input) { stage(input) }
      function stage(input) { return input }

      function other() {
        function stage(value) { next(value) }
        function next(value) { finish(value) }
        function finish(value) { save(value) }
        function save(value) { return value }
      }
    `,
    // A spread before the value makes its parameter position unknowable, so flow stops after the direct receiver.
    dedent`
      function run(model, extras) { stage(...extras, model) }
      function stage(other, value) {
        first(value)
        second(value)
        third(value)
      }
      function first(value) {}
      function second(value) {}
      function third(value) {}
    `,
    // Once the receiving parameter changes, later calls carry the replacement rather than the original value.
    dedent`
      function run(model) { stage(model) }
      function stage(value) {
        value = replacement
        first(value)
        second(value)
        third(value)
      }
      function first(value) {}
      function second(value) {}
      function third(value) {}
    `,
    // Stable aliases all resolve to the same receiving function and therefore count only once.
    dedent`
      function run(model) {
        first(model)
        second(model)
        third(model)
        fourth(model)
      }
      function receive(value) {}
      const first = receive
      const second = receive
      const third = receive
      const fourth = receive
    `,
    // Re-declaring `var` starts a second value lifetime; the two initializers must never be merged.
    dedent`
      function run() {
        var model = firstValue
        first(model)
        second(model)
        var model = secondValue
        third(model)
        fourth(model)
      }
      function first(value) {}
      function second(value) {}
      function third(value) {}
      function fourth(value) {}
    `,
    { name: "indexes many argument positions in one call", code: independentArguments(500) },
    { name: "indexes deeply nested function bodies once", code: nestedFunctionsAround("use()", 400) },
    { name: "shares a convergent reach across many roots", code: convergentRoots(80) }
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
    },
    {
      code: dedent`
        const run = (node) => stage1(node)
        const stage1 = (node) => stage2(node)
        const stage2 = (node) => stage3(node)
        const stage3 = (node) => finish(node)
        const finish = (node) => node
      `,
      errors: [ { messageId: "threadedState", data: { name: "node", count: "4" } } ]
    },
    {
      code: dedent`
        function run(node) { stage1(node) }
        function stage1(entry = null) { stage2(entry) }
        function stage2(entry = null) { stage3(entry) }
        function stage3(entry = null) { finish(entry) }
        function finish(entry = null) { return entry }
      `,
      errors: [ { messageId: "threadedState", data: { name: "node", count: "4" } } ]
    },
    {
      code: dedent`
        function run(model) {
          stage(model, other)
          stage(other, model)
        }

        function stage(left, right) {
          first(left)
          second(right)
        }

        function first(value) {}
        function second(value) {}
      `,
      options: [ { minFunctions: 3 } ],
      errors: [ { messageId: "threadedState", data: { name: "model", count: "3" } } ]
    },
    {
      code: dedent`
        function run(node) {
          class Deferred { value = run(node.child) }
          stage1(node)
        }
        function stage1(node) { stage2(node) }
        function stage2(node) { stage3(node) }
        function stage3(node) { finish(node) }
        function finish(node) {}
      `,
      errors: [ { messageId: "threadedState", data: { name: "node", count: "4" } } ]
    },
    {
      code: dedent`
        function run(model) {
          first(model)
          second(model)
          third(model)
          fourth(model)
          fifth(model)
        }
        function first(value) {}
        function second(value) {}
        function third(value) {}
        function fourth(value) {}
        function fifth(value) {}
      `,
      errors: [ { message: "`model` is threaded through at least 4 functions. Make it the state of a class." } ]
    }
  ]
})

function independentArguments(count) {
  const names = Array.from({ length: count }, (_, index) => `value${index}`)
  return `function sink(${names}) {}\n${names.map(constantNamed).join("\n")}\nsink(${names})`
}

function constantNamed(name) {
  return `const ${name} = 1`
}

function nestedFunctionsAround(inner, count) {
  return Array.from({ length: count }, (_, index) => count - index - 1)
    .reduce((body, index) => `function f${index}(value${index}) { ${body} }`, inner)
}

function convergentRoots(count) {
  const names = Array.from({ length: count }, (_, index) => `value${index}`)
  return [
    names.map((name) => `const ${name} = {}`).join("\n"),
    names.map((name) => `route(${name})`).join("\n"),
    `function route(value) { ${Array.from({ length: count }, () => "sink(value)").join("\n")} }`,
    "function sink(value) {}"
  ].join("\n")
}
