import rule from "#rules/browser/no_class_selector"
import { tester } from "#support"

tester.run("browser/no-class-selector", rule, {
  valid: [
    // Non-class selectors are fine.
    'this.element.querySelector("[data-menu]")',
    'document.querySelector("#main")',
    'el.closest("form")',
    'el.matches("[disabled]")',
    'this.querySelectorAll("input")',
    // A like-named method on something that is not a DOM node is left alone.
    'path.join(".foo")'
  ],
  invalid: [
    {
      code: 'this.element.querySelector(".menu")',
      errors: [ { messageId: "noClassSelector", data: { method: "querySelector" } } ]
    },
    { code: 'document.querySelectorAll(".item")', errors: [ { messageId: "noClassSelector" } ] },
    { code: 'el.closest(".dropdown")', errors: [ { messageId: "noClassSelector" } ] },
    { code: 'el.matches(".active")', errors: [ { messageId: "noClassSelector" } ] },
    // A class in a compound selector still counts.
    { code: 'el.querySelector("a.active")', errors: [ { messageId: "noClassSelector" } ] },
    // A getElementsByClassName call is always a class lookup, whatever the argument.
    { code: 'root.getElementsByClassName("item")', errors: [ { messageId: "noClassSelector" } ] },
    // A template selector with a class token counts too.
    { code: "this.querySelector(`.item`)", errors: [ { messageId: "noClassSelector" } ] }
  ]
})
