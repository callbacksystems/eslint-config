import rule from "#rules/browser/no_class_selector"
import { tester } from "#support"

tester.run("browser/no-class-selector", rule, {
  valid: [
    'this.element.querySelector("[data-menu]")',
    'document.querySelector("#main")',
    'el.closest("form")',
    'el.matches("[disabled]")',
    'this.querySelectorAll("input")',
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
    { code: 'el.querySelector("a.active")', errors: [ { messageId: "noClassSelector" } ] },
    { code: 'root.getElementsByClassName("item")', errors: [ { messageId: "noClassSelector" } ] },
    { code: "this.querySelector(`.item`)", errors: [ { messageId: "noClassSelector" } ] }
  ]
})
