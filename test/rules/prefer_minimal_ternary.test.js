import rule from "#rules/prefer_minimal_ternary"
import { tester } from "#support"

tester.run("prefer-minimal-ternary", rule, {
  valid: [
    "const label = show(isOpen ? a : b)",
    "const label = isOpen ? show(a) : hide(b)",
    "const label = isOpen ? a : b",
    "const label = isOpen ? show(a, 1) : show(b, 2)",
    "const label = isOpen ? show(a) : show(a, b)",
    "const label = isOpen ? show(...first) : show(...second)",
    // The receiver is reached through a property, so the call site would move with the ternary.
    "const label = isOpen ? api.load(a) : api.load(b)",
    // Translation keys stay literal for the locale extractor to find.
    'const label = isOpen ? t("open") : t("closed")',
    'const label = isOpen ? formatMessage({ id: "open" }) : formatMessage({ id: "closed" })',
    'const label = isOpen ? __("open") : __("closed")',
    "const matches = isOpen ? a === 1 : b === 2",
    "const matches = isOpen ? a === 1 : a !== 2",
    // Static property access stays as it is, unlike a computed key.
    "const value = isOpen ? config.first : config.second",
    "const value = isOpen ? first[key] : second[key]"
  ],
  invalid: [
    { code: "const label = isOpen ? show(a) : show(b)", errors: [ { messageId: "minimalTernary" } ] },
    { code: "const label = isOpen ? show(a, shared) : show(b, shared)", errors: [ { messageId: "minimalTernary" } ] },
    { code: "const label = isOpen ? title(a) : title(b)", errors: [ { messageId: "minimalTernary" } ] },
    { code: "const matches = isOpen ? status === 1 : status === 2", errors: [ { messageId: "minimalTernary" } ] },
    {
      code: "const matches = isOpen ? first.value === limit : second.value === limit",
      errors: [ { messageId: "minimalTernary" } ]
    },
    { code: "const value = isOpen ? config[first] : config[second]", errors: [ { messageId: "minimalTernary" } ] }
  ]
})
