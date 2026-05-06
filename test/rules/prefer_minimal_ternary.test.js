import rule from "#rules/prefer_minimal_ternary"
import { tester } from "#support"

tester.run("prefer-minimal-ternary", rule, {
  valid: [
    // Already minimal.
    "const label = show(isOpen ? a : b)",
    // Nothing shared to pull out.
    "const label = isOpen ? show(a) : hide(b)",
    "const label = isOpen ? a : b",
    // More than one argument varies, so no single part carries the difference.
    "const label = isOpen ? show(a, 1) : show(b, 2)",
    // Different arity is a different call.
    "const label = isOpen ? show(a) : show(a, b)",
    // A spread hides how many arguments there are.
    "const label = isOpen ? show(...first) : show(...second)",
    // The receiver is reached through a property, so the call site would move with the ternary.
    "const label = isOpen ? api.load(a) : api.load(b)",
    // Translation keys stay literal for the locale extractor to find.
    'const label = isOpen ? t("open") : t("closed")',
    'const label = isOpen ? formatMessage({ id: "open" }) : formatMessage({ id: "closed" })',
    'const label = isOpen ? __("open") : __("closed")',
    // Both sides of the comparison vary.
    "const matches = isOpen ? a === 1 : b === 2",
    // Different operators are different comparisons.
    "const matches = isOpen ? a === 1 : a !== 2",
    // Static property access stays readable as it is.
    "const value = isOpen ? config.first : config.second",
    // The object varies, which would wrap the receiver in a ternary.
    "const value = isOpen ? first[key] : second[key]"
  ],
  invalid: [
    { code: "const label = isOpen ? show(a) : show(b)", errors: [ { messageId: "minimalTernary" } ] },
    { code: "const label = isOpen ? show(a, shared) : show(b, shared)", errors: [ { messageId: "minimalTernary" } ] },
    // `title` is not a translation helper, so this one moves like any other call.
    { code: "const label = isOpen ? title(a) : title(b)", errors: [ { messageId: "minimalTernary" } ] },
    // The comparison varies on the right, with a plain left side to write once.
    { code: "const matches = isOpen ? status === 1 : status === 2", errors: [ { messageId: "minimalTernary" } ] },
    // ...and on the left, where the shared right side needs nothing of it.
    {
      code: "const matches = isOpen ? first.value === limit : second.value === limit",
      errors: [ { messageId: "minimalTernary" } ]
    },
    // The key is already computed, so moving the ternary into it costs nothing.
    { code: "const value = isOpen ? config[first] : config[second]", errors: [ { messageId: "minimalTernary" } ] }
  ]
})
