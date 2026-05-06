import rule from "#rules/stimulus/no-manual-static-attribute-query"
import { tester } from "#support"

tester.run("stimulus/no-manual-static-attribute-query", rule, {
  valid: [
    // Plain data attributes are fine.
    'this.element.querySelector("[data-menu]")',
    'el.matches("[data-turbo-permanent]")',
    'el.getAttribute("data-controller")',
    // A single-word `-value`/`-class` attribute does not fit the Stimulus grammar (identifier plus name), so a custom
    // `data-sort-value` passes.
    'el.getAttribute("data-sort-value")',
    'el.querySelector("[data-theme-class]")',
    "el.dataset.selectedValue",
    "el.dataset.url",
    // A dynamic identifier cannot be resolved statically.
    'el.querySelector("[data-" + identifier + "-target]")'
  ],
  invalid: [
    {
      code: "this.element.querySelector(\"[data-menu-target='button']\")",
      errors: [ {
        messageId: "manualStaticQuery",
        data: { attribute: "data-menu-target", api: "targets", accessor: "this.fooTarget" }
      } ]
    },
    { code: 'el.querySelectorAll("[data-modal-open-value]")', errors: [ { messageId: "manualStaticQuery" } ] },
    { code: 'el.closest("[data-list-item-outlet]")', errors: [ { messageId: "manualStaticQuery" } ] },
    // A wiring attribute inside a compound selector still counts.
    { code: 'el.matches("button[data-tabs-active-class]")', errors: [ { messageId: "manualStaticQuery" } ] },
    // A static template selector counts too.
    { code: 'el.querySelector(`[data-menu-target="item"]`)', errors: [ { messageId: "manualStaticQuery" } ] },
    // Attribute calls bypass the API the same way selectors do.
    {
      code: 'el.getAttribute("data-menu-open-value")',
      errors: [ {
        messageId: "manualStaticQuery",
        data: { attribute: "data-menu-open-value", api: "values", accessor: "this.fooValue" }
      } ]
    },
    { code: 'el.setAttribute("data-menu-open-value", "true")', errors: [ { messageId: "manualStaticQuery" } ] },
    { code: 'el.hasAttribute("data-tabs-active-class")', errors: [ { messageId: "manualStaticQuery" } ] },
    { code: 'el.removeAttribute("data-menu-target")', errors: [ { messageId: "manualStaticQuery" } ] },
    // `dataset` reaches the same attributes through camelized keys.
    {
      code: "this.element.dataset.menuOpenValue",
      errors: [ {
        messageId: "manualStaticQuery",
        data: { attribute: "menuOpenValue", api: "values", accessor: "this.fooValue" }
      } ]
    },
    { code: "el.dataset.fooTarget", errors: [ { messageId: "manualStaticQuery" } ] },
    { code: 'el.dataset["menuOpenValue"]', errors: [ { messageId: "manualStaticQuery" } ] },
    { code: 'el.dataset.menuOpenValue = "true"', errors: [ { messageId: "manualStaticQuery" } ] },
    { code: "delete el.dataset.fooTarget", errors: [ { messageId: "manualStaticQuery" } ] }
  ]
})
