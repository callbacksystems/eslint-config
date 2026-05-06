import rule from "#rules/prefer_constant"
import { dedent, tester } from "#support"

tester.run("prefer-constant", rule, {
  valid: [
    // Exported: the shape is API, whatever it returns.
    "export function defaults() { return { retries: 3 } }",
    "export default function limit() { return 3 }",
    // A public method can be the extension point a subclass overrides.
    "class C { defaults() { return { retries: 3 } } }",
    "class C { get label() { return \"Save\" } }",
    // Composed, not stated: the value reads a binding or calls something.
    "function defaults() { return { retries: MAX } }",
    "function defaults() { return { at: Date.now() } }",
    "function defaults() { return [ ...BASE, 3 ] }",
    "function defaults() { return { [key]: 3 } }",
    "function label(name) { return `Hi ` + name }",
    // More than a lone return.
    dedent`
      function defaults() {
        record()
        return { retries: 3 }
      }
    `
  ],
  invalid: [
    { code: "function limit() { return 3 }", errors: [ { messageId: "preferConstant", data: { name: "limit" } } ] },
    {
      code: "function defaults() { return { retries: 3, verbose: false } }",
      errors: [ { messageId: "preferConstant", data: { name: "defaults" } } ]
    },
    {
      code: "function levels() { return [ 1, 2, 3 ] }",
      errors: [ { messageId: "preferConstant", data: { name: "levels" } } ]
    },
    {
      code: "function nested() { return { limits: { max: -1 }, names: [ \"a\" ] } }",
      errors: [ { messageId: "preferConstant", data: { name: "nested" } } ]
    },
    {
      code: "function greeting() { return `hello` }",
      errors: [ { messageId: "preferConstant", data: { name: "greeting" } } ]
    },
    // Private members cannot be overridden, so the same reasoning holds.
    {
      code: "class C { #limit() { return 3 } }",
      errors: [ { messageId: "preferConstant", data: { name: "#limit" } } ]
    },
    {
      code: "class C { get #defaults() { return { retries: 3 } } }",
      errors: [ { messageId: "preferConstant", data: { name: "#defaults" } } ]
    }
  ]
})
