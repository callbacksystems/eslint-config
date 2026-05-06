import rule from "#rules/no_handler_prefix"
import { tester } from "#support"

tester.run("no-handler-prefix", rule, {
  valid: [
    "class C { openDialog() {} }",
    "class C { save = () => {} }",
    "function loadUser() {}",
    "const submit = () => {}",
    // `handle` not followed by an uppercase letter is a real word.
    "function handle() {}",
    // The `on` prefix is intentionally allowed (visitor helpers, preposition).
    "function onTypes() {}",
    "const onClick = () => {}",
    // Object literals and config keys are an API, left alone.
    "const config = { handleClick: () => {} }"
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
