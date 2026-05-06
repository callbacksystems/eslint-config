import { enableRules } from "#helpers/eslint/config"

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
  // Assignment in an expression (`if (x = foo())`) is a valid pattern when intentional.
  "sonarjs/no-nested-assignment": "off",
  // Duplicates of ESLint core rules `js.configs.recommended` already enables.
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
