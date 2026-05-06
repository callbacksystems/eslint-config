import rule from "#rules/react/no-suffix-handler-types"
import { dedent, tester } from "#test/support"

tester.run("no-suffix-handler-types", rule, {
  valid: [
    "function saveDraft() {}",
    "function compute() {}",
    "class TaskList {}",
    "class InputHandler {}",
    "const useCounter = () => {}",
    dedent`
      class FooController extends Controller {
        connect() {}
      }
    `
  ],
  invalid: [
    { code: "function useSubmitEventFlow() {}", errors: [ { messageId: "hookSuffix" } ] },
    { code: "class MailDispatcher {}", errors: [ { messageId: "suffix" } ] },
    { code: "class TaskManager {}", errors: [ { messageId: "suffix" } ] },
    { code: "const useDataManager = () => {}", errors: [ { messageId: "hookSuffix" } ] }
  ]
})
