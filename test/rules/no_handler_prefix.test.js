import rule from "#rules/no_handler_prefix"
import { tester } from "#support"

tester.run("no-handler-prefix", rule, {
  valid: [
    "class C { openDialog() {} }",
    "class C { save = () => {} }",
    "function loadUser() {}",
    "const submit = () => {}",
    "function handle() {}",
    // `on` stays allowed, since it is a preposition in visitor helpers like `onTypes`.
    "function onTypes() {}",
    "const onClick = () => {}",
    "const config = { handleClick: () => {} }",
    // A computed key declares no name of its own.
    "class C { [handleClick]() {} }"
  ],
  invalid: [
    { code: "class C { handleClick() {} }", errors: [ { messageId: "handlerPrefix", data: { name: "handleClick" } } ] },
    { code: "class C { #handleTap() {} }", errors: [ { messageId: "handlerPrefix", data: { name: "handleTap" } } ] },
    { code: "function handleError() {}", errors: [ { messageId: "handlerPrefix", data: { name: "handleError" } } ] },
    { code: "const handleSave = () => {}", errors: [ { messageId: "handlerPrefix", data: { name: "handleSave" } } ] },
    {
      code: "class C { handleTap = () => {} }",
      errors: [ { messageId: "handlerPrefix", data: { name: "handleTap" } } ]
    }
  ]
})
