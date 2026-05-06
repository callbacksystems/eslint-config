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
    // A comment inside the guard stays on that negative path in an explicit alternate.
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
          if (x) {
            doSomething()
          } else {
            // nothing to do
            return
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    // Indenting a multi-line literal would alter its runtime value, so the fixer stands down.
    {
      code: dedent`
        function f(x) {
          if (!x) return
          use(${"`"}first
        value${"`"})
        }
      `,
      output: null,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    {
      code: "function f(x) {\r\n  if (!x) return\r\n  work()\r\n}",
      output: "function f(x) {\r\n  if (x) {\r\n    work()\r\n  }\r\n}",
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    // A trailing guard comment heads the whole wrap rather than being reassigned to the positive branch.
    {
      code: dedent`
        function f(x) {
          if (!x) return null // failure
          return ok
        }
      `,
      output: dedent`
        function f(x) {
          if (x) {
            return ok
          } else {
            // failure
            return null
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    // A comment already carried by the condition must not be duplicated above the replacement.
    {
      code: dedent`
        function f(x) {
          if (!(/* why */ x)) return
          doSomething()
        }
      `,
      output: dedent`
        function f(x) {
          if ((/* why */ x)) {
            doSomething()
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    // A comment attached to the `if` header may describe its original polarity, so the report remains fixless.
    {
      code: dedent`
        function f(ok) {
          if /* condition is negated */ (!ok) return false
          return true
        }
      `,
      output: null,
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
    // A trailing comment belongs to the last happy-path statement, not to the generated closing brace.
    {
      code: dedent`
        function f(x) {
          if (!x) return
          run() // describes run
        }
      `,
      output: dedent`
        function f(x) {
          if (x) {
            run() // describes run
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
    },
    // Keep the guard value's outer parentheses: they prevent its line comment from triggering ASI in the `else`.
    {
      code: dedent`
        function f(x) {
          if (!x) return (
            a // plus b
            + b
          )
          return ok
        }
      `,
      output: dedent`
        function f(x) {
          if (x) {
            return ok
          } else {
            return (
            a // plus b
            + b
          )
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    // A line comment in the condition must not consume the generated closing parenthesis.
    {
      code: dedent`
        function f(x) {
          if (
            !x // absent
          ) return
          doSomething()
        }
      `,
      output: dedent`
        function f(x) {
          if (x // absent
          ) {
            doSomething()
          }
        }
      `,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    {
      code: dedent`
        function f(x) {
          use(helper)
          if (!x) return
          function helper() {}
        }
      `,
      output: null,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    // Direct eval can observe a declaration before the wrap changes its lexical scope.
    {
      code: dedent`
        function f(x) {
          eval("helper()")
          if (!x) return
          function helper() {}
        }
      `,
      output: null,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    {
      code: dedent`
        function f(x) {
          with (object) use(dynamicName)
          if (!x) return
          const value = compute()
          use(value)
        }
      `,
      output: null,
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    // Annex B exposes a labeled function before its declaration; wrapping it changes that visibility.
    {
      code: dedent`
        function outer(ok) {
          results.push(typeof helper)
          if (!ok) return
          label: function helper() { return "h" }
          results.push(typeof helper + ":" + helper())
        }
      `,
      output: null,
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    // Moving this directive into the generated `else` would make it target the wrong statement.
    {
      code: dedent`
        function f(ok) {
          if (!ok) return false // eslint-disable-next-line no-undef
          hiddenGlobal()
          return true
        }
      `,
      output: null,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    {
      code: "function f(ok) { if (!ok) return hiddenGlobal // eslint-disable-line no-undef\nreturn true }",
      output: null,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    {
      code: "function f(ok) { /* istanbul ignore if */\nif (!ok) return\nwork() }",
      output: null,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    // A function declaration becomes lexical inside the generated block and would collide with its `var`.
    {
      code: dedent`
        function f(ok) {
          if (!ok) return false
          function helper() {}
          if (nested) { var helper = 1 }
          return helper
        }
      `,
      output: null,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    // Duplicate function declarations are valid in a function body but not as block-scoped declarations.
    {
      code: dedent`
        function f(ok) {
          if (!ok) return false
          function helper() { return 1 }
          function helper() { return 2 }
          return helper()
        }
      `,
      output: null,
      errors: [ { messageId: "preferPositiveWrap" } ]
    },
    {
      name: "handles deeply labeled declarations without consuming the call stack",
      code: labeledFunctionAtDepth(300),
      output: positiveLabeledFunctionAtDepth(300),
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "preferPositiveWrap" } ]
    }
  ]
})

function labeledFunctionAtDepth(depth) {
  return `function outer(ok) { if (!ok) return; ${labelsAtDepth(depth)} function helper() {} }`
}

function labelsAtDepth(depth) {
  return Array.from({ length: depth }, (_, index) => `label${index}:`).join(" ")
}

function positiveLabeledFunctionAtDepth(depth) {
  return `function outer(ok) { if (ok) {\n${" ".repeat(23)}${labelsAtDepth(depth)} function helper() {}`
    + `\n${" ".repeat(21)}} }`
}
