import rule from "#rules/browser/prefer_reflected_aria_properties"
import { tester } from "#support"

tester.run("browser/prefer-reflected-aria-properties", rule, {
  valid: [
    'el.setAttribute("data-menu", "x")',
    'el.getAttribute("href")',
    'el.setAttribute("aria-bogus", "x")',
    'el.setAttribute("aria-\u{212A}eyshortcuts", "x")',
    'el.setAttribute(name, "true")',
    // `hasAttribute` stays: `el.ariaPressed !== null` does not read better.
    'el.hasAttribute("aria-pressed")',
    'options.get("aria-label")',
    'class C { #getAttribute() {} read() { return this.#getAttribute("aria-label") } }'
  ],
  invalid: [
    // Comments in syntax removed by the rewrite make the diagnostic report-only.
    {
      code: "element.getAttribute(/* keep */ \"aria-label\")",
      output: null,
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    // A coverage directive may distinguish a call from the generated property read.
    {
      code: "/* istanbul ignore next */\nelement.getAttribute(\"aria-label\")",
      output: null,
      errors: [ { messageId: "useReflectedProperty" } ]
    },
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
      name: "preserves grouping required by the receiver",
      code: 'const label = (primary ? primary : fallback).getAttribute("aria-label")',
      output: "const label = (primary ? primary : fallback).ariaLabel",
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    {
      name: "preserves grouping that terminates an optional chain",
      code: 'const label = (container?.element).getAttribute("aria-label")',
      output: "const label = (container?.element).ariaLabel",
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    {
      name: "preserves a numeric receiver's required parentheses",
      code: 'const label = (1).getAttribute("aria-label")',
      output: "const label = (1).ariaLabel",
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    {
      name: "preserves grouping before a computed attribute method",
      code: 'const label = ((element))[(`getAttribute`)]("aria-label")',
      output: "const label = ((element)).ariaLabel",
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
      code: 'el.setAttribute("ARIA-KEYSHORTCUTS", "true")',
      output: 'el.ariaKeyShortcuts = "true"',
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
      code: 'el.getAttribute("aria-label", sideEffect())',
      output: null,
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    {
      code: 'el.removeAttribute("aria-hidden", sideEffect())',
      output: null,
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    { code: 'el.setAttribute("aria-label", null)', output: null, errors: [ { messageId: "useReflectedProperty" } ] },
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
