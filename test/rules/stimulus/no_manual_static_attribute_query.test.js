import rule from "#rules/stimulus/no_manual_static_attribute_query"
import { tester } from "#support"

tester.run("stimulus/no-manual-static-attribute-query", rule, {
  valid: [
    'this.element.querySelector("[data-menu]")',
    'el.matches("[data-turbo-permanent]")',
    'el.getAttribute("data-controller")',
    // A single-word `-value`/`-class` attribute does not fit the Stimulus grammar (identifier plus name).
    'el.getAttribute("data-sort-value")',
    'el.querySelector("[data-theme-class]")',
    "el.dataset.selectedValue",
    "el.dataset.url",
    'el.querySelector("[data-" + identifier + "-target]")',
    // A plain function is no DOM query.
    'select("[data-menu-target]")',
    'el.closest("button")',
    "el.dataset[key]"
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
    { code: 'el.matches("button[data-tabs-active-class]")', errors: [ { messageId: "manualStaticQuery" } ] },
    { code: 'el.querySelector(`[data-menu-target="item"]`)', errors: [ { messageId: "manualStaticQuery" } ] },
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
