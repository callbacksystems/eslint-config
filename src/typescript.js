import tseslint from "typescript-eslint"
import { enableRules, mergeConfigRules } from "#helpers"

export default [
  {
    files: [ "**/*.{ts,tsx}" ],
    plugins: {
      "@typescript-eslint": tseslint.plugin
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        projectService: true
      }
    },
    rules: {
      ...mergeConfigRules(tseslint.configs.strictTypeChecked),
      ...mergeConfigRules(tseslint.configs.stylisticTypeChecked),

      ...enableRules([
        "@typescript-eslint/default-param-last",
        "@typescript-eslint/explicit-module-boundary-types",
        "@typescript-eslint/no-dupe-class-members",
        "@typescript-eslint/no-redeclare",
        "@typescript-eslint/no-shadow",
        "@typescript-eslint/prefer-enum-initializers",
        "@typescript-eslint/prefer-readonly",
        "@typescript-eslint/switch-exhaustiveness-check"
      ]),

      "@typescript-eslint/no-magic-numbers": [ "error", {
        ignore: [ -1, 0, 1, 2 ],
        ignoreArrayIndexes: true,
        ignoreEnums: true,
        ignoreNumericLiteralTypes: true,
        ignoreTypeIndexes: true
      } ],

      "@typescript-eslint/explicit-member-accessibility": [ "error", { accessibility: "no-public" } ],
      "@typescript-eslint/parameter-properties": [ "error", { prefer: "class-property" } ],
      "@typescript-eslint/consistent-type-imports": [ "error", { prefer: "type-imports" } ],

      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: [ "camelCase" ], leadingUnderscore: "forbid" },
        {
          selector: "variable",
          modifiers: [ "const", "global" ],
          format: [ "UPPER_CASE", "camelCase" ]
        },
        { selector: "class", format: [ "PascalCase" ] },
        {
          selector: "interface",
          format: [ "PascalCase" ],
          custom: { regex: "^I[A-Z]", match: false }
        },
        { selector: "typeAlias", format: [ "PascalCase" ] },
        { selector: "typeParameter", format: [ "PascalCase" ], leadingUnderscore: "forbid" },
        {
          selector: "memberLike",
          modifiers: [ "private" ],
          format: [ "camelCase" ],
          leadingUnderscore: "forbid"
        },
        {
          selector: [ "accessor", "method", "function", "variable" ],
          types: [ "boolean" ],
          format: [ "camelCase" ],
          prefix: [
            "is", "are", "has", "can", "should", "will", "would",
            "did", "was", "supports", "contains", "allows", "accepts"
          ]
        },
        {
          selector: "parameter",
          modifiers: [ "unused" ],
          format: [ "camelCase" ],
          leadingUnderscore: "require"
        }
      ]
    }
  }
]
