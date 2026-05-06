import rule from "#rules/browser/prefer-reflected-aria-properties"
import { tester } from "#support"

tester.run("browser/prefer-reflected-aria-properties", rule, {
  valid: [
    // Non-ARIA attributes are left alone.
    'el.setAttribute("data-menu", "x")',
    'el.getAttribute("href")',
    // An unknown aria-* attribute has no reflected property to point to.
    'el.setAttribute("aria-bogus", "x")',
    // A dynamic attribute name cannot be resolved statically.
    'el.setAttribute(name, "true")',
    // `hasAttribute` stays: `el.ariaPressed !== null` does not read better.
    'el.hasAttribute("aria-pressed")',
    // A like-named method on something that is not a DOM node is left alone.
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
    // The property name is not a plain camelization of the attribute.
    {
      code: 'el.setAttribute("aria-multiline", "true")',
      output: 'el.ariaMultiLine = "true"',
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    // `role` reflects too.
    {
      code: 'button.setAttribute("role", "tab")',
      output: 'button.role = "tab"',
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    // A getter read rewrites in any expression position.
    {
      code: 'if (el.getAttribute("aria-expanded") === "true") collapse()',
      output: 'if (el.ariaExpanded === "true") collapse()',
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    // The subject expression is carried over verbatim.
    {
      code: 'this.buttonTarget.setAttribute("aria-busy", "true")',
      output: 'this.buttonTarget.ariaBusy = "true"',
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    // A sequence value needs parentheses to stay one assignment.
    {
      code: 'el.setAttribute("aria-label", (a, b))',
      output: "el.ariaLabel = (a, b)",
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    // A write used as a value cannot become an assignment, so no fix.
    {
      code: 'const result = el.setAttribute("aria-busy", "true")',
      output: null,
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    // Optional chaining has no assignment form, so no fix.
    {
      code: 'el?.setAttribute("aria-expanded", "false")',
      output: null,
      errors: [ { messageId: "useReflectedProperty" } ]
    },
    // IDREF attributes reflect as element references; the rewrite changes the value's shape (elements, not IDs), so it
    // stays manual.
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
