import { enableRules } from "#helpers/config"

export const sonarjsRules = {
  ...enableRules([
    "sonarjs/arguments-usage",
    "sonarjs/array-constructor",
    "sonarjs/no-built-in-override",
    "sonarjs/no-collapsible-if",
    "sonarjs/no-for-in-iterable",
    "sonarjs/no-function-declaration-in-block",
    "sonarjs/no-nested-incdec",
    "sonarjs/no-undefined-assignment",
    "sonarjs/operation-returning-nan",
    "sonarjs/prefer-immediate-return",
    "sonarjs/prefer-object-literal",
    "sonarjs/shorthand-property-grouping",
    "sonarjs/too-many-break-or-continue-in-loop",
    "sonarjs/unicode-aware-regex",
    "sonarjs/values-not-convertible-to-numbers"
  ]),
  // Assignment in expressions (`if (x = foo())`, ternary branches with `=`) is a valid pattern when used intentionally.
  "sonarjs/no-nested-assignment": "off",
  // Sonarjs duplicates of ESLint core rules already enabled by `js.configs.recommended`. Disable the sonarjs copy to
  // avoid double-reporting on the same construct.
  "sonarjs/no-control-regex": "off",
  "sonarjs/no-delete-var": "off",
  "sonarjs/no-empty-character-class": "off",
  "sonarjs/no-fallthrough": "off",
  "sonarjs/no-invalid-regexp": "off",
  "sonarjs/no-misleading-character-class": "off",
  "sonarjs/no-regex-spaces": "off",
  "sonarjs/no-unused-vars": "off",
  "sonarjs/no-useless-catch": "off"
}
