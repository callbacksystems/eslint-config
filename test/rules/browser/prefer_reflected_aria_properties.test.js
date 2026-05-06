import rule from "#rules/browser/prefer_reflected_aria_properties"
import { tester } from "#support"

tester.run("browser/prefer-reflected-aria-properties", rule, {
  valid: [
    'el.setAttribute("data-menu", "x")',
    'el.getAttribute("href")',
    'el.setAttribute("aria-bogus", "x")',
    'el.setAttribute(name, "true")',
    // `hasAttribute` stays: `el.ariaPressed !== null` does not read better.
    'el.hasAttribute("aria-pressed")',
    'options.get("aria-label")'
  ],
  invalid: [
    {
      code: 'el.setAttribute("aria-pressed", "true")',
      output: 'el.ariaPressed = "true"',
      errors: [ {
        messageId: "useReflectedProperty",
        data: { property: "ariaPressed", method: "setAttribute", attribute: "aria-pressed" }
      } ]
    },
    {
      code: 'const label = el.getAttribute("aria-label")',
      output: "const label = el.ariaLabel",
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    {
      code: 'el.removeAttribute("aria-hidden")',
      output: "el.ariaHidden = null",
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    {
      code: 'el.setAttribute("aria-multiline", "true")',
      output: 'el.ariaMultiLine = "true"',
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    {
      code: 'button.setAttribute("role", "tab")',
      output: 'button.role = "tab"',
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    {
      code: 'if (el.getAttribute("aria-expanded") === "true") collapse()',
      output: 'if (el.ariaExpanded === "true") collapse()',
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    {
      code: 'this.buttonTarget.setAttribute("aria-busy", "true")',
      output: 'this.buttonTarget.ariaBusy = "true"',
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    {
      code: 'el.setAttribute("aria-label", (a, b))',
      output: "el.ariaLabel = (a, b)",
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    {
      code: 'const result = el.setAttribute("aria-busy", "true")',
      output: null,
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    {
      code: 'el?.setAttribute("aria-expanded", "false")',
      output: null,
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    // IDREF attributes reflect as element references, so the rewrite would change the value's shape.
    {
      code: 'el.setAttribute("aria-labelledby", headingId)',
      output: null,
      errors: [ {
        messageId: "useElementReferences",
        data: { property: "ariaLabelledByElements", method: "setAttribute", attribute: "aria-labelledby" }
      } ]
    },
    {
      code: 'el.getAttribute("aria-activedescendant")',
      output: null,
      errors: [ {
        messageId: "useElementReferences",
        data: { property: "ariaActiveDescendantElement", method: "getAttribute", attribute: "aria-activedescendant" }
      } ]
    }
  ]
})
