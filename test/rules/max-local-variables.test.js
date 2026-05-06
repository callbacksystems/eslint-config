import rule from "#rules/max-local-variables"
import { tester } from "#support"

tester.run("max-local-variables", rule, {
  valid: [
    // Three locals is the default limit.
    "function f() { const a = 1; const b = 2; const c = 3; return a + b + c }",
    // Property assignments are not local variables.
    "function f(config) { config.a = 1; config.b = 2; config.c = 3; config.d = 4 }",
    // Locals inside a nested function don't count toward the outer one.
    "function outer() { const a = 1; return list.map((item) => { const b = 2; const c = 3; const d = 4; return b }) }"
  ],
  invalid: [
    {
      code: "function f() { const a = 1; const b = 2; const c = 3; const d = 4; return a }",
      errors: [ { messageId: "tooManyLocals", data: { count: "4", max: "3" } } ]
    },
    {
      code: "function f() { const a = 1; const b = 2; const c = 3 }",
      options: [ { max: 2 } ],
      errors: [ { messageId: "tooManyLocals", data: { count: "3", max: "2" } } ]
    }
  ]
})
