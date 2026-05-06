import rule from "#rules/browser/query-selector-suffix"
import { dedent, tester } from "#support"

tester.run("browser/query-selector-suffix", rule, {
  valid: [
    dedent`
      class C {
        get menuElement() { return this.element.querySelector(".menu") }
      }
    `,
    dedent`
      class C {
        get itemElements() { return this.element.querySelectorAll(".item") }
      }
    `,
    // Memoized getter keeps the suffix.
    dedent`
      class C {
        #menu
        get menuElement() { return this.#menu ??= this.querySelector(".menu") }
      }
    `,
    // Not a querySelector result: no suffix required.
    dedent`
      class C {
        get title() { return this.element.querySelector(".t").textContent }
      }
    `,
    "class C { get count() { return this.items.length } }",
    // A call whose property collides with `Object.prototype` is not a query method.
    dedent`
      class C {
        get iso() { return this.date.toString() }
      }
    `,
    dedent`
      class C {
        get type() { return this.thing.constructor() }
      }
    `,
    // Only getters are checked.
    dedent`
      class C {
        menu() { return this.querySelector(".menu") }
        set menu(value) { this.querySelector(".menu") }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        class C {
          get menu() { return this.element.querySelector(".menu") }
        }
      `,
      errors: [ { messageId: "singularSuffix", data: { name: "menu", suffix: "Element" } } ]
    },
    {
      code: dedent`
        class C {
          get items() { return this.element.querySelectorAll(".item") }
        }
      `,
      errors: [ { messageId: "pluralSuffix", data: { name: "items", suffix: "Elements" } } ]
    },
    {
      // Singular getter named with the plural suffix.
      code: dedent`
        class C {
          get menuElements() { return this.querySelector(".menu") }
        }
      `,
      errors: [ { messageId: "singularSuffix", data: { name: "menuElements", suffix: "Element" } } ]
    },
    {
      // Memoized querySelectorAll still requires the plural suffix.
      code: dedent`
        class C {
          #items
          get items() { return this.#items ??= this.querySelectorAll(".item") }
        }
      `,
      errors: [ { messageId: "pluralSuffix", data: { name: "items", suffix: "Elements" } } ]
    }
  ]
})
