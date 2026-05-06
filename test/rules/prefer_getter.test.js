import rule from "#rules/prefer_getter"
import { tester } from "#support"

tester.run("prefer-getter", rule, {
  valid: [
    "class C { scaled(factor) { return factor * 2 } }",
    "class C { total() { const base = 1; return base } }",
    "class C { async data() { return 1 } }",
    "class C { toggle() { return this.open = true } }",
    "class C { reset() { return this } }",
    "class C { handler() { return () => this.run() } }",
    "class C { toString() { return this.label } }",
    "class C { get size() { return this.items.length } }"
  ],
  invalid: [
    {
      code: "class C { size() { return this.items.length } }",
      errors: [ { messageId: "preferGetter", data: { name: "size" } } ]
    },
    {
      code: "class C { #names() { return this.list.map((item) => item.name) } }",
      errors: [ { messageId: "preferGetter", data: { name: "#names" } } ]
    }
  ]
})
