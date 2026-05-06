import rule from "#rules/stimulus/action-naming"
import { tester } from "#test/support"

tester.run("stimulus/action-naming", rule, {
  valid: [
    // Imperative action name.
    "class C extends Controller { change(event) {} }",
    // `handle` is caught globally by no-handler-prefix, not here.
    "class C extends Controller { handleChange(event) {} }",
    // `on` outside a controller is allowed (preposition, visitor helpers, etc.).
    "class C { onChange(event) {} }",
    // Private members are not actions.
    "class C extends Controller { #onTick() {} }"
  ],
  invalid: [
    {
      code: "class C extends Controller { onChange(event) {} }",
      errors: [ { messageId: "onPrefix", data: { name: "onChange" } } ]
    },
    {
      code: "class C extends Controller { onSubmit = (event) => {} }",
      errors: [ { messageId: "onPrefix", data: { name: "onSubmit" } } ]
    }
  ]
})
