import rule from "#rules/no-method-named-call"
import { dedent, tester } from "#test/support"

tester.run("no-method-named-call", rule, {
  valid: [
    "class Order { process() {} }",
    "class Order { static createFromCart() {} }",
    "function process() {}",
    "class Webhook { callExternalApi() {} }",
    "class Webhook { callback() {} }",
    "function callback() {}",
    "order.call()",
    "this.call(arg)",
    dedent`
      class Order {
        process() {}
        ship() {}
      }
    `
  ],
  invalid: [
    { code: "class OrderProcessor { call() {} }", errors: [ { messageId: "methodNamedCall" } ] },
    { code: "class OrderProcessor { static call() {} }", errors: [ { messageId: "methodNamedCall" } ] },
    { code: "class OrderProcessor { get call() { return 1 } }", errors: [ { messageId: "methodNamedCall" } ] },
    { code: "class OrderProcessor { set call(value) {} }", errors: [ { messageId: "methodNamedCall" } ] },
    { code: "function call() {}", errors: [ { messageId: "methodNamedCall" } ] },
    { code: "class A { #call() {} }", errors: [ { messageId: "methodNamedCall" } ] },
    {
      code: dedent`
        class OrderProcessor {
          call() {}
          static call() {}
        }
      `,
      errors: [ { messageId: "methodNamedCall" }, { messageId: "methodNamedCall" } ]
    }
  ]
})
