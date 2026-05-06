import rule from "#rules/no_mutable_module_scope"
import { dedent, tester } from "#support"

tester.run("no-mutable-module-scope", rule, {
  valid: [
    "const X = 1",
    "const Y = new Map()",
    "const Z = []",
    dedent`
      function helper() {
        let local = 1
        return local
      }
    `,
    dedent`
      class Foo {
        method() {
          let inside = 1
          return inside
        }
      }
    `
  ],
  invalid: [
    { code: "let counter = 0", errors: [ { messageId: "mutableModuleScope" } ] },
    { code: "var legacy = 'bad'", errors: [ { messageId: "mutableModuleScope" } ] },
    {
      code: "let a, b, c",
      errors: [
        { messageId: "mutableModuleScope" },
        { messageId: "mutableModuleScope" },
        { messageId: "mutableModuleScope" }
      ]
    }
  ]
})
