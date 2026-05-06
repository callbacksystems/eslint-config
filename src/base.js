import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript"
import js from "@eslint/js"
import stylistic from "@stylistic/eslint-plugin"
import sonarjs from "eslint-plugin-sonarjs"
import unicorn from "eslint-plugin-unicorn"
import { importX } from "eslint-plugin-import-x"
import perfectionist from "eslint-plugin-perfectionist"
import callbacksystems from "#rules"
import { enableRules } from "#helpers"

const coreRules = {
  "no-unused-vars": [ "error", { args: "none", caughtErrors: "none" } ],
  // Assigning inside a condition is a valid terse pattern; the rule prevents
  // typos but rejects intentional uses too.
  "no-cond-assign": "off",
  "no-nested-ternary": "error",
  "camelcase": [ "error", { properties: "never", ignoreDestructuring: true } ],
  "id-length": [ "error", {
    min: 2,
    exceptions: [ "i", "j", "x", "y", "a", "b", "_", "fn", "ms", "id" ]
  } ],
  "id-denylist": [
    "error",
    "e", "evt", "ev", "el", "elem", "btn", "msg", "ctrl", "tgt",
    "str", "num", "idx", "tmp", "obj", "arr", "ctx", "cb", "req", "res", "val", "diff"
  ],
  "no-empty-function": [ "error", { allow: [ "methods" ] } ],
  "grouped-accessor-pairs": [ "error", "getBeforeSet" ],
  "prefer-destructuring": [ "error", { object: true, array: false } ],
  "sort-imports": [ "error", { ignoreDeclarationSort: true } ],
  "capitalized-comments": [ "error", "always", {
    ignoreConsecutiveComments: true,
    ignorePattern: "^[a-z]+:"
  } ],
  "multiline-comment-style": [ "error", "separate-lines" ],
  "arrow-body-style": [ "error", "as-needed" ],
  ...enableRules([
    "accessor-pairs",
    "default-case-last",
    "dot-notation",
    "eqeqeq",
    "max-params",
    "new-cap",
    "no-caller",
    "no-constructor-return",
    "no-continue",
    "no-extend-native",
    "no-extra-bind",
    "no-lone-blocks",
    "no-lonely-if",
    "no-multi-str",
    "no-new-func",
    "no-octal-escape",
    "no-proto",
    "no-return-await",
    "no-self-compare",
    "no-sequences",
    "no-template-curly-in-string",
    "no-throw-literal",
    "no-undef-init",
    "no-unmodified-loop-condition",
    "no-unneeded-ternary",
    "no-unreachable-loop",
    "no-unused-expressions",
    "no-useless-call",
    "no-useless-constructor",
    "no-useless-rename",
    "object-shorthand",
    "prefer-arrow-callback",
    "prefer-numeric-literals",
    "prefer-object-has-own",
    "prefer-object-spread",
    "prefer-regex-literals",
    "prefer-rest-params",
    "prefer-spread",
    "prefer-template",
    "require-atomic-updates",
    "strict",
    "symbol-description",
    "unicode-bom"
  ])
}

const styleRules = {
  "@stylistic/array-bracket-spacing": [ "error", "always" ],
  "@stylistic/arrow-spacing": [ "error", { before: true, after: true } ],
  "@stylistic/block-spacing": [ "error", "always" ],
  "@stylistic/brace-style": "error",
  "@stylistic/comma-dangle": [ "error", "never" ],
  "@stylistic/comma-spacing": [ "error", { before: false, after: true } ],
  "@stylistic/comma-style": [ "error", "last" ],
  "@stylistic/computed-property-spacing": [ "error", "never" ],
  "@stylistic/eol-last": "error",
  "@stylistic/function-call-spacing": [ "error", "never" ],
  "@stylistic/indent": [ "error", 2, { SwitchCase: 1 } ],
  "@stylistic/key-spacing": [ "error", { beforeColon: false, afterColon: true } ],
  "@stylistic/keyword-spacing": "error",
  "@stylistic/max-len": [ "error", { code: 120 } ],
  "@stylistic/max-statements-per-line": "error",
  "@stylistic/no-extra-semi": "error",
  "@stylistic/no-multi-spaces": "error",
  "@stylistic/no-multiple-empty-lines": [ "error", { max: 1, maxBOF: 0, maxEOF: 0 } ],
  "@stylistic/no-trailing-spaces": "error",
  "@stylistic/nonblock-statement-body-position": [ "error", "beside" ],
  "@stylistic/object-curly-spacing": [ "error", "always" ],
  "@stylistic/quotes": [ "error", "double", { avoidEscape: true } ],
  "@stylistic/semi": [ "error", "never" ],
  "@stylistic/space-infix-ops": "error",
  "@stylistic/spaced-comment": [ "error", "always" ],
  "@stylistic/multiline-ternary": [ "error", "always-multiline" ],
  "@stylistic/lines-around-comment": [ "error", { beforeBlockComment: true } ],
  "@stylistic/no-mixed-operators": [ "error", { groups: [ [ "&&", "||" ] ] } ],
  curly: [ "error", "multi-line" ],
  "no-var": "error",
  "prefer-const": [ "error", { destructuring: "all" } ]
}

const complexityRules = {
  complexity: [ "error", { max: 7 } ],
  "max-depth": [ "error", { max: 3 } ],
  "max-lines": [ "error", { max: 300, skipBlankLines: true, skipComments: true } ],
  "max-lines-per-function": [ "error", { max: 30, skipBlankLines: true, skipComments: true } ],
  "max-nested-callbacks": [ "error", { max: 3 } ],
  "max-statements": [ "error", { max: 10 } ],
  "max-classes-per-file": [ "error", { max: 1 } ],
  "sonarjs/cognitive-complexity": [ "error", 7 ]
}

const sonarjsRules = {
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
  // Assignment in expressions (`if (x = foo())`, ternary branches with `=`) is
  // a valid pattern when used intentionally.
  "sonarjs/no-nested-assignment": "off"
}

const unicornRules = {
  // Only require switch-case braces when scope is needed (let/const inside).
  "unicorn/switch-case-braces": [ "error", "avoid" ],
  // Only suggest ternary when both branches fit on one line; multi-line
  // branches lose readability.
  "unicorn/prefer-ternary": [ "error", "only-single-line" ],
  // Anonymous default exports are fine when the filename gives context.
  "unicorn/no-anonymous-default-export": "off",
  // Functional preferences that clash with OO style.
  "unicorn/no-array-callback-reference": "off",
  "unicorn/no-array-for-each": "off",
  "unicorn/no-array-reduce": "off",
  "unicorn/no-array-reverse": "off",
  "unicorn/no-array-sort": "off",
  "unicorn/no-instanceof-builtins": "off",
  "unicorn/prefer-prototype-methods": "off",
  "unicorn/prefer-reflect-apply": "off",
  "unicorn/prefer-spread": "off",
  // `null` is fine
  "unicorn/no-null": "off",
  // CLI scripts legitimately call process.exit().
  "unicorn/no-process-exit": "off",
  // TODOs without expiry dates are normal.
  "unicorn/expiring-todo-comments": "off",
  // Conflicts with sonarjs/no-global-this, native `window` is fine in browser apps.
  "unicorn/prefer-global-this": "off",
  // 37signals convention: snake_case for all source files.
  "unicorn/filename-case": [ "error", { case: "snakeCase" } ],
  // Numeric separators (1_000_000) are visually nice but screen readers handle them poorly.
  "unicorn/numeric-separators-style": "off",
  // DOM-only rules; re-enabled in /browser.
  "unicorn/no-document-cookie": "off",
  "unicorn/no-invalid-remove-event-listener": "off",
  "unicorn/prefer-add-event-listener": "off",
  "unicorn/prefer-classlist-toggle": "off",
  "unicorn/prefer-dom-node-append": "off",
  "unicorn/prefer-dom-node-dataset": "off",
  "unicorn/prefer-dom-node-remove": "off",
  "unicorn/prefer-dom-node-text-content": "off",
  "unicorn/prefer-keyboard-event-key": "off",
  "unicorn/prefer-modern-dom-apis": "off",
  "unicorn/prefer-query-selector": "off",
  // Extras not in unicorn recommended.
  "unicorn/consistent-destructuring": "error",
  "unicorn/custom-error-definition": "error",
  "unicorn/no-unused-properties": "error",
  // Allow `Props` (React vocabulary) and `params` (universal short form).
  "unicorn/prevent-abbreviations": [ "error", {
    allowList: { Props: true, Prop: true, params: true, Params: true, Param: true }
  } ]
}

const importRules = {
  ...importX.configs["flat/recommended"].rules,
  ...enableRules([
    // Promoted from warn (recommended default) to error.
    "import-x/no-duplicates",
    "import-x/no-named-as-default",
    "import-x/no-named-as-default-member",
    // Not in any preset.
    "import-x/first",
    "import-x/no-absolute-path",
    "import-x/no-mutable-exports",
    "import-x/no-self-import",
    "import-x/no-useless-path-segments"
  ]),
  "import-x/no-cycle": [ "error", { maxDepth: 8 } ],
  // Forbid extensions on local files (.js/.ts/etc) but allow npm packages
  // whose name legitimately ends in .js (e.g. `@rails/request.js`).
  "import-x/extensions": [ "error", "ignorePackages", {
    cjs: "never",
    js: "never",
    jsx: "never",
    mjs: "never",
    ts: "never",
    tsx: "never"
  } ],
  "import-x/order": [ "error", {
    groups: [ "builtin", "external", "internal", "parent", "sibling", "index", "type" ],
    "newlines-between": "never"
  } ]
}

const callbacksystemsRules = enableRules([
  "callbacksystems/compact-guard-clause",
  "callbacksystems/compact-object-pattern",
  "callbacksystems/max-logical-operators-per-condition",
  "callbacksystems/max-validation-guards-per-function",
  "callbacksystems/no-alias-imports",
  "callbacksystems/no-em-dash",
  "callbacksystems/no-loop-accumulator",
  "callbacksystems/no-mid-function-returns",
  "callbacksystems/no-parameter-clump",
  "callbacksystems/no-redundant-trailing-return",
  "callbacksystems/no-relative-imports",
  "callbacksystems/no-section-divider-comments",
  "callbacksystems/padding-after-guard-clause",
  "callbacksystems/prefer-positive-wrap",
  "callbacksystems/prefer-tail-condition",
  "callbacksystems/prefer-ternary-return"
])

const perfectionistRules = {
  "perfectionist/sort-classes": [ "error", {
    type: "unsorted",
    groups: [
      "static-property",
      "property",
      "private-property",
      "static-method",
      "constructor",
      [ "method", "function-property" ],
      "get-method",
      "set-method",
      [ "private-method", "private-function-property" ],
      "private-get-method",
      "private-set-method"
    ]
  } ],
  "perfectionist/sort-named-imports": [ "error", { type: "alphabetical", order: "asc", ignoreCase: false } ],
  "perfectionist/sort-named-exports": [ "error", { type: "alphabetical", order: "asc", ignoreCase: false } ]
}

export default [
  {
    ignores: [
      // Generic
      "coverage/**",
      "dist/**",
      "node_modules/**",
      // Rails
      "log/**",
      "public/**",
      "storage/**",
      "tmp/**",
      "vendor/**",
      // Astro
      ".astro/**",
      // Expo / React Native
      ".expo/**",
      ".expo-shared/**",
      // Cloudflare Workers
      ".wrangler/**"
    ]
  },
  sonarjs.configs.recommended,
  unicorn.configs.recommended,
  {
    files: [ "**/*.{cjs,js,jsx,mjs,ts,tsx}" ],
    plugins: {
      "@stylistic": stylistic,
      "import-x": importX,
      callbacksystems,
      perfectionist
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
    },
    settings: {
      "import-x/resolver-next": [ createTypeScriptImportResolver() ]
    },
    rules: {
      ...js.configs.recommended.rules,
      ...coreRules,
      ...styleRules,
      ...complexityRules,
      ...sonarjsRules,
      ...unicornRules,
      ...importRules,
      ...callbacksystemsRules,
      ...perfectionistRules
    }
  }
]
