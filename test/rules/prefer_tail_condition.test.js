import rule from "#rules/prefer_tail_condition"
import { dedent, tester } from "#support"

tester.run("prefer-tail-condition", rule, {
  valid: [
    dedent`
      function f(x) {
        if (!x) return 1
      }
    `,
    // Not in tail position: statements follow the block, so dropping the `return` would let a bailing call fall through
    // into them.
    dedent`
      function f(x) {
        if (x) {
          if (done) return
          return value
        }
        return other
      }
    `,
    // A loop body is never tail position: the original leaves the function, the rewrite would move on to the next
    // iteration.
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
    `,
    // Falling out of a finalizer resumes the completion pending from the try; an explicit return cancels it.
    dedent`
      function f(done) {
        try {
          return 1
        } finally {
          if (done) return
          return 2
        }
      }
    `
  ],
  invalid: [
    // Running off the end of a `try` block leaves the function just the same.
    {
      code: dedent`
        function f(x) {
          try {
            if (done) return
            return value
          } finally {
            cleanup()
          }
        }
      `,
      output: dedent`
        function f(x) {
          try {
            if (!done) return value
          } finally {
            cleanup()
          }
        }
      `,
      errors: [ { messageId: "preferTailCondition" } ]
    },
    // A comment above the value-return describes that successful result, not the removed guard path.
    {
      code: dedent`
        function f() {
          if (done) return
          // Compute the successful value.
          return compute()
        }
      `,
      output: dedent`
        function f() {
          // Compute the successful value.
          if (!done) return compute()
        }
      `,
      errors: [ { messageId: "preferTailCondition" } ]
    },
    {
      code: dedent`
        function f() {
          if (done) return // No result.
          return compute() // Successful result.
        }
      `,
      output: dedent`
        function f() {
          if (!done) return compute() // Successful result.
          else {
            // No result.
            return
          }
        }
      `,
      errors: [ { messageId: "preferTailCondition" } ]
    },
    // A comment on the removed guard cannot be assigned safely to the opposite branch.
    {
      code: dedent`
        function f(x) {
          if (x) {
            if (done) return // nothing left
            return value
          }
        }
      `,
      output: dedent`
        function f(x) {
          if (x) {
            if (!done) return value
            else {
              // nothing left
              return
            }
          }
        }
      `,
      errors: [ { messageId: "preferTailCondition" } ]
    },
    // A comment attached to the `if` header may describe its original polarity, so the report remains fixless.
    {
      code: dedent`
        function f(done) {
          if /* condition is positive */ (done) return
          return value
        }
      `,
      output: null,
      errors: [ { messageId: "preferTailCondition" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (x) {
            other()
          } else {
            if (done) return
            return value
          }
        }
      `,
      output: dedent`
        function f(x) {
          if (x) {
            other()
          } else {
            if (!done) return value
          }
        }
      `,
      errors: [ { messageId: "preferTailCondition" } ]
    },
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
    },
    {
      code: dedent`
        function f(x) {
          if (ready /* checked */) return
          return compute(/* once */ x)
        }
      `,
      output: dedent`
        function f(x) {
          if (!ready /* checked */) return compute(/* once */ x)
        }
      `,
      errors: [ { messageId: "preferTailCondition" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (! /* keep */ ready) return
          return value
        }
      `,
      output: dedent`
        function f(x) {
          if (/* keep */ ready) return value
        }
      `,
      errors: [ { messageId: "preferTailCondition" } ]
    },
    // Parentheses around a returned value are semantically significant when they protect a line comment from ASI.
    {
      code: dedent`
        function f(x) {
          if (x) return
          return (
            a // plus b
            + b
          )
        }
      `,
      output: dedent`
        function f(x) {
          if (!x) return (
            a // plus b
            + b
          )
        }
      `,
      errors: [ { messageId: "preferTailCondition" } ]
    },
    // The generated closing parenthesis must remain after a condition's trailing line comment.
    {
      code: dedent`
        function f(x) {
          if (
            x // checked
          ) return
          return value
        }
      `,
      output: dedent`
        function f(x) {
          if (!x // checked
          ) return value
        }
      `,
      errors: [ { messageId: "preferTailCondition" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (x) { // bail out
            return
          }
          return value
        }
      `,
      output: dedent`
        function f(x) {
          if (!x) return value
          else {
            // bail out
            return
          }
        }
      `,
      errors: [ { messageId: "preferTailCondition" } ]
    },
    // The directive must keep targeting the returned expression rather than moving into an `else` branch.
    {
      code: dedent`
        function f(done) {
          if (done) return // eslint-disable-next-line no-undef
          return hiddenGlobal()
        }
      `,
      output: null,
      errors: [ { messageId: "preferTailCondition" } ]
    },
    {
      code: "function f() { if (missing) return // eslint-disable-line no-undef\nreturn 1 }",
      output: null,
      errors: [ { messageId: "preferTailCondition" } ]
    },
    {
      code: "function f(done) { /* istanbul ignore if */\nif (done) return\nreturn 1 }",
      output: null,
      errors: [ { messageId: "preferTailCondition" } ]
    }
  ]
})
