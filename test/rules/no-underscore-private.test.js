import rule from "#rules/no-underscore-private"
import { dedent, tester } from "#test/support"

tester.run("no-underscore-private", rule, {
  valid: [
    "class A { #foo = 1 }",
    "class A { #bar() {} }",
    "class A { foo = 1 }",
    "class A { bar() {} }",
    dedent`
      class A {
        #internal = 1
        publicMethod() {}
      }
    `
  ],
  invalid: [
    { code: "class A { _foo = 1 }", errors: [ { messageId: "noUnderscorePrivate" } ] },
    { code: "class A { _bar() {} }", errors: [ { messageId: "noUnderscorePrivate" } ] },
    {
      code: dedent`
        class A {
          _internal = 1
          _doStuff() {}
        }
      `,
      errors: [ { messageId: "noUnderscorePrivate" }, { messageId: "noUnderscorePrivate" } ]
    }
  ]
})
