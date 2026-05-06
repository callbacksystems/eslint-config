import rule from "#rules/browser/no_class_selector"
import { tester } from "#support"

tester.run("browser/no-class-selector", rule, {
  valid: [
    'this.element.querySelector("[data-menu]")',
    'document.querySelector("#main")',
    'el.closest("form")',
    'el.matches("[disabled]")',
    'this.querySelectorAll("input")',
    'path.join(".foo")',
    'document.querySelector("[data-value=\'.5\']")',
    'document.querySelector("[data-value=\'.menu\']")',
    String.raw`document.querySelector("\\.literal-dot")`,
    'document.querySelector("/* .decorative */ [data-menu]")',
    "document.querySelector(`[data-value=\"$" + "{value}.menu\"]`)",
    `document.querySelector("${"[data-value='.ignored']".repeat(1_000)}")`,
    'class View { #querySelector() {} find() { return this.#querySelector(".menu") } }'
  ],
  invalid: [
    {
      code: 'this.element.querySelector(".menu")',
      errors: [ { messageId: "noClassSelector", data: { method: "querySelector" } } ]
    },
    { code: 'document.querySelectorAll(".item")', errors: [ { messageId: "noClassSelector" } ] },
    { code: 'document["querySelector"](".item")', errors: [ { messageId: "noClassSelector" } ] },
    { code: 'el.closest(".dropdown")', errors: [ { messageId: "noClassSelector" } ] },
    { code: 'el.matches(".active")', errors: [ { messageId: "noClassSelector" } ] },
    { code: 'el.querySelector("a.active")', errors: [ { messageId: "noClassSelector" } ] },
    { code: 'root.getElementsByClassName("item")', errors: [ { messageId: "noClassSelector" } ] },
    { code: "this.querySelector(`.item`)", errors: [ { messageId: "noClassSelector" } ] },
    { code: 'document.querySelector(".étiquette")', errors: [ { messageId: "noClassSelector" } ] },
    { code: String.raw`document.querySelector(".\\31 23")`, errors: [ { messageId: "noClassSelector" } ] },
    { code: String.raw`document.querySelector("\\/*.menu")`, errors: [ { messageId: "noClassSelector" } ] },
    { code: 'document.querySelector(".--menu")', errors: [ { messageId: "noClassSelector" } ] },
    { code: 'document.querySelector("[class~=menu]")', errors: [ { messageId: "noClassSelector" } ] },
    { code: 'document.querySelector("[class|=menu]")', errors: [ { messageId: "noClassSelector" } ] },
    { code: 'el.matches("[CLASS]")', errors: [ { messageId: "noClassSelector" } ] },
    { code: String.raw`el.matches("[cl\\61 ss]")`, errors: [ { messageId: "noClassSelector" } ] },
    { code: String.raw`el.matches("[svg|\\63 lass]")`, errors: [ { messageId: "noClassSelector" } ] },
    { code: 'el.matches("[/* name */ CLASS]")', errors: [ { messageId: "noClassSelector" } ] },
    { code: 'el.matches("[class")', errors: [ { messageId: "noClassSelector" } ] },
    {
      code: `document.querySelector("${"[data-ok]".repeat(1_000)}[class]")`,
      errors: [ { messageId: "noClassSelector" } ]
    },
    { code: "document.querySelector(`.item-$" + "{id}`)", errors: [ { messageId: "noClassSelector" } ] }
  ]
})
