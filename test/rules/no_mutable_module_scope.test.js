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
    `,
    "if (enabled) { let attempt = 0; use(attempt) }",
    { filename: "Counter.svelte", code: "let count = 0" },
    { filename: "counter.astro", code: "let count = 0" }
  ],
  invalid: [
    { code: "let counter = 0", errors: [ { messageId: "mutableModuleScope" } ] },
    { code: "var legacy = 'bad'", errors: [ { messageId: "mutableModuleScope" } ] },
    { code: "export let counter = 0", errors: [ { messageId: "mutableModuleScope" } ] },
    { code: "if (enabled) { var leaked = 0 }", errors: [ { messageId: "mutableModuleScope" } ] },
    { code: "let { a, b, c } = value", errors: [ { messageId: "mutableModuleScope" } ] },
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
