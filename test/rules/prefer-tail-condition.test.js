import rule from "#rules/prefer-tail-condition"
import { dedent, tester } from "#test/support"

tester.run("prefer-tail-condition", rule, {
  valid: [
    dedent`
      function f(x) {
        if (!x) return 1
      }
    `,
    // Not in tail position: statements follow the block, so dropping the
    // `return` would let a bailing call fall through into them.
    dedent`
      function f(x) {
        if (x) {
          if (done) return
          return value
        }
        return other
      }
    `,
    // A loop body is never tail position: the original leaves the function, the
    // rewrite would move on to the next iteration.
    dedent`
      function f(xs) {
        for (const x of xs) {
          if (skip) return
          return x
        }
        return fallback
      }
    `,
    // A bare nested block with statements after it.
    dedent`
      function f() {
        {
          if (done) return
          return value
        }
        continueWork()
      }
    `,
    dedent`
      function f(x) {
        if (x) return 1
        return 2
      }
    `,
    dedent`
      function f(x) {
        doSomething()
        return x
      }
    `,
    dedent`
      function f(x) {
        if (x) {
          cleanup()
          return
        }
        return computeValue()
      }
    `,
    dedent`
      function f(x) {
        if (x) throw new Error("bad")
        return computeValue()
      }
    `,
    dedent`
      function f(x) {
        if (x) return
        doMore()
        return computeValue()
      }
    `
  ],
  invalid: [
    // Nested, but still tail position: nothing runs after the block either way.
    {
      code: dedent`
        function f(x) {
          if (x) {
            if (done) return
            return value
          }
        }
      `,
      output: dedent`
        function f(x) {
          if (x) {
            if (!done) return value
          }
        }
      `,
      errors: [ { messageId: "preferTailCondition" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (x) return
          return computeValue()
        }
      `,
      output: dedent`
        function f(x) {
          if (!x) return computeValue()
        }
      `,
      errors: [ { messageId: "preferTailCondition" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (x) {
            return
          }
          return computeValue()
        }
      `,
      output: dedent`
        function f(x) {
          if (!x) return computeValue()
        }
      `,
      errors: [ { messageId: "preferTailCondition" } ]
    }
  ]
})
