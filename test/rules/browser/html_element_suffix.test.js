import rule from "#rules/browser/html_element_suffix"
import { tester } from "#support"

tester.run("browser/html-element-suffix", rule, {
  valid: [
    "class FooElement extends HTMLElement {}",
    "class EditorElement extends HTMLElement {}",
    "class CustomDivElement extends HTMLDivElement {}",
    "class Foo extends OtherClass {}",
    "class Foo {}"
  ],
  invalid: [
    { code: "class Foo extends HTMLElement {}", errors: [ { messageId: "missingSuffix" } ] },
    { code: "class CustomToolbar extends HTMLElement {}", errors: [ { messageId: "missingSuffix" } ] },
    { code: "class MyDiv extends HTMLDivElement {}", errors: [ { messageId: "missingSuffix" } ] }
  ]
})
