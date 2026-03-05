import js from "@eslint/js"
import globals from "globals"
import stylistic from "@stylistic/eslint-plugin"
import perfectionist from "eslint-plugin-perfectionist"
import sonarjs from "eslint-plugin-sonarjs"

export default [
  {
    ignores: [ "dist/*", "node_modules/*", "vendor/*" ]
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        "global": "readonly",
        ...globals.browser
      }
    },
    plugins: {
      "@stylistic": stylistic,
      perfectionist,
      sonarjs
    },
    rules: {
      ...js.configs.recommended.rules,

      // Style
      "@stylistic/array-bracket-spacing": [ "error", "always" ],
      "@stylistic/arrow-spacing": [ "error", { "before": true, "after": true } ],
      "@stylistic/block-spacing": [ "error", "always" ],
      "@stylistic/comma-dangle": [ "error", "never" ],
      "@stylistic/comma-spacing": [ "error", { "before": false, "after": true } ],
      "@stylistic/comma-style": [ "error", "last" ],
      "@stylistic/computed-property-spacing": [ "error", "never" ],
      "@stylistic/eol-last": "error",
      "@stylistic/function-call-spacing": [ "error", "never" ],
      "@stylistic/indent": [ "error", 2, { "SwitchCase": 1 } ],
      "@stylistic/keyword-spacing": "error",
      "@stylistic/no-trailing-spaces": "error",
      "@stylistic/quotes": [ "error", "double", { "avoidEscape": true } ],
      "@stylistic/semi": [ "error", "never" ],
      "@stylistic/space-infix-ops": "error",
      "curly": [ "error", "multi-line" ],
      "no-var": "error",
      "prefer-const": [ "error", { "destructuring": "all" } ],
      "sonarjs/shorthand-property-grouping": "error",

      // Complexity
      "complexity": [ "error", { max: 10 } ],
      "max-depth": [ "error", { max: 3 } ],
      "sonarjs/cognitive-complexity": [ "error", 10 ],
      "sonarjs/no-collapsible-if": "error",
      "sonarjs/no-nested-conditional": "error",

      // Bug prevention
      "sonarjs/anchor-precedence": "error",
      "sonarjs/argument-type": "error",
      "sonarjs/array-callback-without-return": "error",
      "sonarjs/bitwise-operators": "error",
      "sonarjs/comma-or-logical-or-case": "error",
      "sonarjs/constructor-for-side-effects": "error",
      "sonarjs/different-types-comparison": "error",
      "sonarjs/existing-groups": "error",
      "sonarjs/for-loop-increment-sign": "error",
      "sonarjs/generator-without-yield": "error",
      "sonarjs/in-operator-type-error": "error",
      "sonarjs/new-operator-misuse": "error",
      "sonarjs/no-all-duplicated-branches": "error",
      "sonarjs/no-built-in-override": "error",
      "sonarjs/no-collection-size-mischeck": "error",
      "sonarjs/no-element-overwrite": "error",
      "sonarjs/no-empty-collection": "error",
      "sonarjs/no-extra-arguments": "error",
      "sonarjs/no-function-declaration-in-block": "error",
      "sonarjs/no-globals-shadowing": "error",
      "sonarjs/no-ignored-return": "error",
      "sonarjs/no-literal-call": "error",
      "sonarjs/no-misleading-array-reverse": "error",
      "sonarjs/no-parameter-reassignment": "error",
      "sonarjs/no-try-promise": "error",
      "sonarjs/no-unthrown-error": "error",
      "sonarjs/no-use-of-empty-return-value": "error",
      "sonarjs/no-useless-increment": "error",
      "sonarjs/non-existent-operator": "error",
      "sonarjs/null-dereference": "error",
      "sonarjs/operation-returning-nan": "error",
      "sonarjs/reduce-initial-value": "error",
      "sonarjs/updated-const-var": "error",
      "sonarjs/values-not-convertible-to-numbers": "error",

      // Code quality
      "no-unused-vars": [ "error", { "args": "none", "caughtErrors": "none" } ],
      "sonarjs/arguments-usage": "error",
      "sonarjs/array-constructor": "error",
      "sonarjs/class-prototype": "error",
      "sonarjs/function-inside-loop": "error",
      "sonarjs/misplaced-loop-counter": "error",
      "sonarjs/no-array-delete": "error",
      "sonarjs/no-async-constructor": "error",
      "sonarjs/no-dead-store": "error",
      "sonarjs/no-duplicated-branches": "error",
      "sonarjs/no-equals-in-for-termination": "error",
      "sonarjs/no-for-in-iterable": "error",
      "sonarjs/no-gratuitous-expressions": "error",
      "sonarjs/no-identical-expressions": "error",
      "sonarjs/no-identical-functions": "error",
      "sonarjs/no-ignored-exceptions": "error",
      "sonarjs/no-in-misuse": "error",
      "sonarjs/no-invariant-returns": "error",
      "sonarjs/no-inverted-boolean-check": "error",
      "sonarjs/no-labels": "error",
      "sonarjs/no-nested-assignment": "error",
      "sonarjs/no-nested-incdec": "error",
      "sonarjs/no-nested-template-literals": "error",
      "sonarjs/no-primitive-wrappers": "error",
      "sonarjs/no-redundant-assignments": "error",
      "sonarjs/no-redundant-boolean": "error",
      "sonarjs/no-redundant-jump": "error",
      "sonarjs/no-same-line-conditional": "error",
      "sonarjs/no-selector-parameter": "error",
      "sonarjs/no-small-switch": "error",
      "sonarjs/no-undefined-argument": "error",
      "sonarjs/no-undefined-assignment": "error",
      "sonarjs/no-unenclosed-multiline-block": "error",
      "sonarjs/no-unused-collection": "error",
      "sonarjs/no-useless-catch": "error",
      "sonarjs/prefer-default-last": "error",
      "sonarjs/prefer-immediate-return": "error",
      "sonarjs/prefer-object-literal": "error",
      "sonarjs/prefer-promise-shorthand": "error",
      "sonarjs/prefer-regexp-exec": "error",
      "sonarjs/prefer-single-boolean-return": "error",
      "sonarjs/prefer-while": "error",
      "sonarjs/too-many-break-or-continue-in-loop": "error",
      "sonarjs/updated-loop-counter": "error",
      "sonarjs/void-use": "error",

      // Regex
      "sonarjs/concise-regex": "error",
      "sonarjs/duplicates-in-character-class": "error",
      "sonarjs/empty-string-repetition": "error",
      "sonarjs/no-empty-after-reluctant": "error",
      "sonarjs/no-empty-alternatives": "error",
      "sonarjs/no-empty-group": "error",
      "sonarjs/regex-complexity": "error",
      "sonarjs/single-char-in-character-classes": "error",
      "sonarjs/single-character-alternation": "error",
      "sonarjs/stateful-regex": "error",
      "sonarjs/unicode-aware-regex": "error",
      "sonarjs/unused-named-groups": "error",

      // Class member ordering
      "perfectionist/sort-classes": [ "error", {
        type: "unsorted",
        groups: [
          "static-property",
          "property",
          "private-property",
          "static-method",
          "constructor",
          "method",
          "get-method",
          "set-method",
          "private-method",
          "private-get-method",
          "private-set-method"
        ]
      } ]
    }
  }
]
