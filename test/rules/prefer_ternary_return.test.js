import rule from "#rules/prefer_ternary_return"
import { dedent, tester } from "#support"

tester.run("prefer-ternary-return", rule, {
  valid: [
    dedent`
      function f(x) {
        if (x) return
        return 1
      }
    `,
    dedent`
      function f(x) {
        if (a) return 1
        if (b) return 2
        return 3
      }
    `,
    dedent`
      function f(x) {
        if (x) return { a: 1, b: 2, c: 3 }
        return { d: 4, e: 5 }
      }
    `,
    dedent`
      function f(x) {
        if (x) return [ 1, 2 ]
        return []
      }
    `,
    // A ternary built out of a ternary is a nested conditional, which reads worse than the two returns and is rejected
    // by another rule anyway.
    dedent`
      function f(x) {
        if (x) return 1
        return y ? 2 : 3
      }
    `,
    dedent`
      function f(x) {
        if (x) return y ? 1 : 2
        return 3
      }
    `,
    dedent`
      function f(x) {
        if (x) {
          log()
          return 1
        }
        return 2
      }
    `
  ],
  invalid: [
    // A comment trailing either return closes the merged one, and one on a line of its own stands above it.
    {
      code: dedent`
        function f(x) {
          if (x) return 1 // quick path
          return 2
        }
      `,
      output: dedent`
        function f(x) {
          return x ? 1 : 2 // quick path
        }
      `,
      errors: [ { messageId: "preferTernaryReturn" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (x) return 1
          // The slow path.
          return 2
        }
      `,
      output: dedent`
        function f(x) {
          // The slow path.
          return x ? 1 : 2
        }
      `,
      errors: [ { messageId: "preferTernaryReturn" } ]
    },
    // The `&&` shorthand builds no ternary, so a conditional fallback is still fine.
    {
      code: dedent`
        function f(x) {
          if (x) return false
          return y ? 1 : 2
        }
      `,
      output: dedent`
        function f(x) {
          return !x && (y ? 1 : 2)
        }
      `,
      errors: [ { messageId: "preferTernaryReturn", data: { suggestion: "`return !condition && Y`" } } ]
    },
    {
      code: dedent`
        function f(x) {
          if (x === 1) return true
          return y ? 1 : 2
        }
      `,
      output: dedent`
        function f(x) {
          return x === 1 || (y ? 1 : 2)
        }
      `,
      errors: [ { messageId: "preferTernaryReturn", data: { suggestion: "`return condition || Y`" } } ]
    },
    // A provably boolean condition is its own `true`, so `||` preserves the value.
    {
      code: dedent`
        function f(x) {
          if (x === 1) return true
          return fallback
        }
      `,
      output: dedent`
        function f(x) {
          return x === 1 || fallback
        }
      `,
      errors: [ { messageId: "preferTernaryReturn", data: { suggestion: "`return condition || Y`" } } ]
    },
    // A merely truthy condition is not `true`: `x || fallback` would return "yes" where the original returned `true`,
    // so the ternary carries it through.
    {
      code: dedent`
        function f(x) {
          if (x) return true
          return fallback
        }
      `,
      output: dedent`
        function f(x) {
          return x ? true : fallback
        }
      `,
      errors: [ { messageId: "preferTernaryReturn", data: { suggestion: "`return condition ? X : Y`" } } ]
    },
    // `!condition` is always a real boolean, so the `&&` form is safe either way.
    {
      code: dedent`
        function f(x) {
          if (x) return false
          return fallback
        }
      `,
      output: dedent`
        function f(x) {
          return !x && fallback
        }
      `,
      errors: [ { messageId: "preferTernaryReturn", data: { suggestion: "`return !condition && Y`" } } ]
    },
    {
      code: dedent`
        function f(x) {
          if (x) return "yes"
          return "no"
        }
      `,
      output: dedent`
        function f(x) {
          return x ? "yes" : "no"
        }
      `,
      errors: [ { messageId: "preferTernaryReturn" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (x) return false
          return computeFallback()
        }
      `,
      output: dedent`
        function f(x) {
          return !x && computeFallback()
        }
      `,
      errors: [ { messageId: "preferTernaryReturn" } ]
    },
    {
      code: dedent`
        function f(Boolean, value) {
          if (Boolean(value)) return true
          return fallback
        }
      `,
      output: dedent`
        function f(Boolean, value) {
          return Boolean(value) ? true : fallback
        }
      `,
      errors: [ { messageId: "preferTernaryReturn", data: { suggestion: "`return condition ? X : Y`" } } ]
    },
    {
      code: dedent`
        /* global Boolean:writable */
        Boolean = String
        function f(value) {
          if (Boolean(value)) return true
          return fallback
        }
      `,
      output: dedent`
        /* global Boolean:writable */
        Boolean = String
        function f(value) {
          return Boolean(value) ? true : fallback
        }
      `,
      errors: [ { messageId: "preferTernaryReturn", data: { suggestion: "`return condition ? X : Y`" } } ]
    },
    {
      code: dedent`
        function f(x) {
          if (x) return build(/* exactly once */ x)
          return fallback
        }
      `,
      output: dedent`
        function f(x) {
          return x ? build(/* exactly once */ x) : fallback
        }
      `,
      errors: [ { messageId: "preferTernaryReturn" } ]
    },
    // Merging the statements would delete or retarget the directive that belongs to the following return.
    {
      code: dedent`
        function f(x) {
          if (x) return false // eslint-disable-next-line no-undef
          return hidden
        }
      `,
      output: null,
      errors: [ { messageId: "preferTernaryReturn" } ]
    },
    // Coverage directives attached to the original branch must keep targeting that branch.
    {
      code: dedent`
        function f(x) {
          /* istanbul ignore if */
          if (x) return 1
          return 2
        }
      `,
      output: null,
      errors: [ { messageId: "preferTernaryReturn" } ]
    }
  ]
})
