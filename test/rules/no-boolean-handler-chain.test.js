import rule from "#rules/no-boolean-handler-chain"
import { dedent, tester } from "#test/support"

tester.run("no-boolean-handler-chain", rule, {
  valid: [
    "function f() { return tryA() }",
    "function f() { return tryA() || tryB() }",
    "function f() { return tryA() && tryB() && tryC() }"
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
    }
  ]
})
