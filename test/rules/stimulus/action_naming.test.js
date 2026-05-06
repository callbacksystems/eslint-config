import rule from "#rules/stimulus/action_naming"
import { tester } from "#support"

tester.run("stimulus/action-naming", rule, {
  valid: [
    "class C extends Controller { change(event) {} }",
    // `handle` is caught globally by no-handler-prefix, not here.
    "class C extends Controller { handleChange(event) {} }",
    "class C { onChange(event) {} }",
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
