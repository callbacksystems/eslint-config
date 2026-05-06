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
    'el.getAttribute("data-admin--open-value")',
    'el.getAttribute("data-admin---menu-open-value")',
    'el.getAttribute("data-admin-billing--open-value")',
    'el.getAttribute("data-menu-Key-value")',
    `el.getAttribute("data-${"a-".repeat(1_000)}a-nope")`,
    [ "el.getAttribute(`data-menu-target$", "{suffix}`)" ].join(""),
    "el.dataset.selectedValue",
    "el.dataset.url",
    'el.dataset["menu-open-value"]',
    'el.dataset["data-menu-target"]',
    'el.querySelector("[data-" + identifier + "-target]")',
    [ "el.querySelector(`[data-$", "{identifier}-target]`)" ].join(""),
    [ "el.querySelector(`[data-menu-$", "{name}-value]`)" ].join(""),
    [ "el.querySelector(`[data-menu-target$", "{suffix}]`)" ].join(""),
    [ "el.querySelector(`[data-$", "{identifier}-target][data-menu-open-value]`)" ].join(""),
    // A plain function is no DOM query.
    'select("[data-menu-target]")',
    'el.closest("button")',
    "el.dataset[key]",
    "const { selectedValue } = el.dataset",
    "const { value } = object",
    "const options = { value: 1 }",
    'el.querySelector("[title=\'data-menu-target\']")',
    'el.getAttribute("prefix-data-menu-open-value")',
    'el.querySelector("/* [data-menu-target] */ [data-ok]")',
    'el.querySelector("[title=\'[data-menu-target]\']")',
    [ "el.querySelector(`[title=\"$", "{value}[data-menu-target]\"]`)" ].join(""),
    'class View { #getAttribute() {} read() { return this.#getAttribute("data-menu-target") } }',
    "class View { #dataset = store; read() { return this.#dataset.menuOpenValue } }",
    "class View { #menuOpenValue; read(dataset) { return dataset.#menuOpenValue } }"
  ],
  invalid: [
    {
      code: "const query = 'querySelector'; this.element[query](\"[data-menu-target='button']\")",
      errors: [ { messageId: "manualStaticQuery" } ]
    },
    {
      code: "const dataset = 'dataset'; const key = 'menuOpenValue'; el[dataset][key]",
      errors: [ { messageId: "manualStaticQuery" } ]
    },
    {
      code: "const dataset = 'dataset'; const key = 'menuOpenValue'; const { [key]: value } = el[dataset]",
      errors: [ { messageId: "manualStaticQuery" } ]
    },
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
      code: [ "el.querySelector(`[data-menu-target].$", "{className}`)" ].join(""),
      errors: [ { messageId: "manualStaticQuery" } ]
    },
    {
      code: [ "el.querySelector(`[data-ok][data-menu-open-value]$", "{suffix}`)" ].join(""),
      errors: [ { messageId: "manualStaticQuery" } ]
    },
    {
      code: `el.querySelector("${"[data-ok]".repeat(1_000)}[data-menu-target]")`,
      errors: [ { messageId: "manualStaticQuery" } ]
    },
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
    { code: 'el.toggleAttribute("data-menu-open-value")', errors: [ { messageId: "manualStaticQuery" } ] },
    { code: 'el.getAttribute("DATA-MENU-OPEN-VALUE")', errors: [ { messageId: "manualStaticQuery" } ] },
    {
      code: 'el.getAttribute("data-admin--billing-profile-active-value")',
      errors: [ {
        messageId: "manualStaticQuery",
        data: { attribute: "data-admin--billing-profile-active-value", api: "values", accessor: "this.fooValue" }
      } ]
    },
    { code: 'el.querySelector("[data-users--list-target]")', errors: [ { messageId: "manualStaticQuery" } ] },
    {
      code: 'el.querySelector("[data-chat-admin--user-status-outlet]")',
      errors: [ { messageId: "manualStaticQuery" } ]
    },
    { code: 'el.getAttribute("data-chat-admin--user-outlet")', errors: [ { messageId: "manualStaticQuery" } ] },
    {
      code: "this.element.dataset.menuOpenValue",
      errors: [ {
        messageId: "manualStaticQuery",
        data: { attribute: "menuOpenValue", api: "values", accessor: "this.fooValue" }
      } ]
    },
    { code: "el.dataset.fooTarget", errors: [ { messageId: "manualStaticQuery" } ] },
    { code: 'el.dataset["menuOpenValue"]', errors: [ { messageId: "manualStaticQuery" } ] },
    { code: 'el.dataset["users-ListTarget"]', errors: [ { messageId: "manualStaticQuery" } ] },
    { code: 'el.dataset["chatAdmin-UserStatusOutlet"]', errors: [ { messageId: "manualStaticQuery" } ] },
    { code: 'el.dataset["chatAdmin-UserOutlet"]', errors: [ { messageId: "manualStaticQuery" } ] },
    { code: 'el.dataset["data-MenuTarget"]', errors: [ { messageId: "manualStaticQuery" } ] },
    { code: "el.dataset[`fooTarget`]", errors: [ { messageId: "manualStaticQuery" } ] },
    { code: "el[`getAttribute`]('data-menu-target')", errors: [ { messageId: "manualStaticQuery" } ] },
    { code: 'el.dataset.menuOpenValue = "true"', errors: [ { messageId: "manualStaticQuery" } ] },
    { code: "delete el.dataset.fooTarget", errors: [ { messageId: "manualStaticQuery" } ] },
    { code: "const { menuOpenValue } = el.dataset", errors: [ { messageId: "manualStaticQuery" } ] },
    { code: "({ fooTarget } = el.dataset)", errors: [ { messageId: "manualStaticQuery" } ] }
  ]
})
