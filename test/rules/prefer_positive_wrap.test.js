import rule from "#rules/prefer_positive_wrap"
import { dedent, tester } from "#support"

tester.run("prefer-positive-wrap", rule, {
  valid: [
    // The happy path does not exit, so a trailing `return null` would change semantics.
    dedent`
      function f(x) {
        if (!x) return null
        happyPath()
      }
    `,
    dedent`
      function f(x) {
        if (x) return doSomething()
      }
    `,
    // Wrapping would push the happy path past `max-depth` (3), so the rule defers to that constraint.
    dedent`
      function f(x) {
        if (!x) return
        if (a) {
          if (b) {
            if (c) {
              doStuff()
            }
          }
        }
      }
    `,
    // The guard does more than return, so it is not one.
    dedent`
      function f(x) {
        if (!x) {
          log()
          return
        }
        doSomething()
      }
    `,
    // An exit inside the happy path would end up mid-function once wrapped.
    dedent`
      function f(x) {
        if (!x) return
        if (a) {
          return b
        }
        finish()
      }
    `,
    dedent`
      function f(x) {
        if (!x) return
        if (a) {
          doStuff()
        } else {
          return
        }
      }
    `
  ],
  invalid: [
    // A comment inside the guard heads the wrap, since the guard itself is gone.
    {
      code: dedent`
        function f(x) {
          if (!x) { // nothing to do
            return
          }
          doSomething()
        }
      `,
      output: dedent`
        function f(x) {
          // nothing to do
          if (x) {
            doSomething()
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (!x) return
          doSomething()
        }
      `,
      output: dedent`
        function f(x) {
          if (x) {
            doSomething()
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (!x) {
            return
          }
          doSomething()
        }
      `,
      output: dedent`
        function f(x) {
          if (x) {
            doSomething()
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    // A blank line in the happy path stays blank, and a nested `if` without an exit wraps along.
    {
      code: dedent`
        function f(x) {
          if (!x) return
          prepare()

          if (a) {
            doStuff()
          }
        }
      `,
      output: dedent`
        function f(x) {
          if (x) {
            prepare()

            if (a) {
              doStuff()
            }
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    // A nested function's body resets the depth, as it does for `max-depth`.
    {
      code: dedent`
        function f(x) {
          if (!x) return
          run(() => {
            if (a) {
              if (b) {
                if (c) {
                  doStuff()
                }
              }
            }
          })
        }
      `,
      output: dedent`
        function f(x) {
          if (x) {
            run(() => {
              if (a) {
                if (b) {
                  if (c) {
                    doStuff()
                  }
                }
              }
            })
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (!ready) return
          start()
          finish()
        }
      `,
      output: dedent`
        function f(x) {
          if (ready) {
            start()
            finish()
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (!x) return null
          const value = compute()
          return value
        }
      `,
      output: dedent`
        function f(x) {
          if (x) {
            const value = compute()
            return value
          } else {
            return null
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    {
      code: dedent`
        function f(x) {
          if (!ready) return null
          return { ok: true }
        }
      `,
      output: dedent`
        function f(x) {
          if (ready) {
            return { ok: true }
          } else {
            return null
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    }
  ]
})
