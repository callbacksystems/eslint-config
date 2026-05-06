import rule from "#rules/no_boolean_handler_chain"
import { dedent, tester } from "#support"

tester.run("no-boolean-handler-chain", rule, {
  valid: [
    "function f() { return tryA() }",
    "function f() { return tryA() || tryB() }",
    "function f() { return tryA() && tryB() && tryC() }",
    { code: "function f() { return tryA() || tryB() || tryC() }", options: [ { min: 4 } ] }
  ],
  invalid: [
    {
      code: dedent`
        function dispatch() {
          return tryA() || tryB() || tryC()
        }
      `,
      errors: [ { messageId: "booleanHandlerChain" } ]
    },
    {
      code: dedent`
        function dispatch() {
          return applyToggleRead(req) || applyToggleFlag(req) || dispatchPermanentDelete(req) || dispatchMove(req)
        }
      `,
      errors: [ { messageId: "booleanHandlerChain" } ]
    },
    {
      code: "function f() { return tryA() || tryB() }",
      options: [ { min: 2 } ],
      errors: [ { messageId: "booleanHandlerChain" } ]
    }
  ]
})
