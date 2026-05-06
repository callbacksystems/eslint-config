import rule from "#rules/no-parameter-clump"
import { dedent, tester } from "#test/support"

tester.run("no-parameter-clump", rule, {
  valid: [
    dedent`
      class A {
        foo() {}
      }
    `,
    dedent`
      class A {
        foo(name, kind) {}
        bar(name) {}
        baz(kind) {}
      }
    `,
    dedent`
      function topLevel(a, b) {}
      function alsoTop(a, b) {}
      function third(a, b) {}
    `
  ],
  invalid: [
    {
      code: dedent`
        class Tracker {
          a(width, height) {}
          b(width, height) {}
          c(width, height, color) {}
        }
      `,
      errors: [ { messageId: "parameterClump" } ]
    }
  ]
})
