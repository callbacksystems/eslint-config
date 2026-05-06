import rule from "#rules/no_effectful_bare_return"
import { dedent, tester } from "#support"

const DOLLAR = "$"

tester.run("no-effectful-bare-return", rule, {
  valid: [
    // An inline guard exits before any work: the good shape.
    "function f() { if (done) return }",
    // A single-statement guard block carries no work; it is collapsed elsewhere.
    "function f() { if (done) { return } }",
    // The branch returns a real value, not a bare bail-out.
    dedent`
      function f() {
        if (ready) {
          prepare()
          return result
        }
      }
    `,
    // The branch does work but never returns.
    dedent`
      function f() {
        if (ready) {
          prepare()
          finish()
        }
      }
    `,
    "function f(x) { if (x) { ; return } }",
    'function f(x) { if (x) { "note"; return } }',
    "function f(x) { if (x) { `note`; return } }",
    `function f(x) { if (x) { \`${DOLLAR}{1}\`; return } }`,
    "function f(x) { if (x) { void 0; return } }",
    "function f(x) { if (x) { typeof missing; return } }",
    "function f(x) { if (x) { false && reset(); return } }",
    "function f(x) { if (x) { true || reset(); return } }",
    "function f(x) { if (x) { 1 ?? reset(); return } }",
    "function f(x) { if (x) { true ? 1 : reset(); return } }",
    "function f(x) { if (x) { false ? reset() : 1; return } }",
    "function f(x, condition) { if (x) { condition ? 1 : 2; return } }",
    "function f(x) { if (x) { (() => reset()); return } }",
    "function f(x) { if (x) { (function deferred() { reset() }); return } }",
    "function f(x, value) { if (x) { ({ value, [1]: value }); return } }",
    "function f(x) { if (x) { function helper() {}; return } }",
    "function f(x, observed) { if (x) { observed; return } }",
    "import { observed } from 'values'; function f(x) { if (x) { observed; return } }",
    "function f(x, flag) { if (x) { if (flag) return; return } }",
    "function f(x) { if (x) { return; return } }",
    // Compound abrupt statements also make the final return unreachable.
    "function f(x) { if (x) { { return } work(); return } }",
    "function f(x) { if (x) { label: { return } work(); return } }",
    "function f(x) { if (x) { try { return } finally {} work(); return } }",
    "function f(x) { if (x) { while (false) {} do {} while (false); for (; false;) {} "
    + "switch (x) { case 1: break } throw x; return } }"
  ],
  invalid: [
    {
      code: dedent`
        function f() {
          if (something) {
            anotherThing()
            return
          }
        }
      `,
      errors: [ { messageId: "effectfulBareReturn" } ]
    },
    {
      // The same smell in an else branch.
      code: dedent`
        function f() {
          if (ready) {
            start()
          } else {
            reset()
            return
          }
        }
      `,
      errors: [ { messageId: "effectfulBareReturn" } ]
    },
    {
      // Both branches offend independently.
      code: dedent`
        function f() {
          if (ready) {
            start()
            return
          } else {
            reset()
            return
          }
        }
      `,
      errors: [ { messageId: "effectfulBareReturn" }, { messageId: "effectfulBareReturn" } ]
    },
    {
      code: dedent`
        function f() {
          if (ready) {
            skip: { break skip }
            reset()
            return
          }
        }
      `,
      errors: [ { messageId: "effectfulBareReturn" } ]
    },
    {
      code: dedent`
        function f(ready, flag) {
          if (ready) {
            if (flag) {
              reset()
              return
            }
            return
          }
        }
      `,
      errors: [ { messageId: "effectfulBareReturn", line: 5 } ]
    },
    { code: "function f() { if (ready) { void reset(); return } }", errors: [ { messageId: "effectfulBareReturn" } ] },
    { code: "function f() { if (ready) { true && reset(); return } }", errors: 1 },
    { code: "function f() { if (ready) { false || reset(); return } }", errors: 1 },
    { code: "function f() { if (ready) { null ?? reset(); return } }", errors: 1 },
    {
      code: `function f() { if (ready) { \`${DOLLAR}{reset()}\`; return } }`,
      errors: [ { messageId: "effectfulBareReturn" } ]
    },
    { code: "function f(flag) { if (flag) { observed; return } }", errors: [ { messageId: "effectfulBareReturn" } ] },
    {
      code: "var observed; function f(flag) { if (flag) { observed; return } }",
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "effectfulBareReturn" } ]
    },
    {
      code: "function f(flag, object, local) { with (object) { if (flag) { local; return } } }",
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "effectfulBareReturn" } ]
    },
    { code: "function f(x) { if (x) { skip: { reset(); break skip } return } }", errors: 1 },
    { code: "function f(x) { if (x) { repeat: do { reset(); continue repeat } while (false); return } }", errors: 1 },
    { code: "function f(x) { if (x) { while (true) { reset(); break } return } }", errors: 1 },
    { code: "function f(x) { if (x) { try { throw x } catch { reset() } return } }", errors: 1 },
    { code: "function f(flag) { if (flag) { try { throw {} } catch ({ value = observe() }) {} return } }", errors: 1 },
    { code: "function f(x) { if (x) { try {} finally { reset() } return } }", errors: 1 },
    {
      code: "function f() { if (ready) { class Helper {}; return } }",
      errors: [ { messageId: "effectfulBareReturn" } ]
    },
    { name: "shares completion outcomes across deeply nested branches", code: nestedBranches(600), errors: 1 }
  ]
})

function nestedBranches(count) {
  return `function f(condition) { ${Array.from({ length: count }).reduce(branchAround, "reset(); return")} }`
}

function branchAround(body) {
  return `if (condition) { ${body} } return`
}
