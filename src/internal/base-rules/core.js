import { enableRules } from "#helpers/config"

export const coreRules = {
  "no-unused-vars": [ "error", { args: "none", caughtErrors: "none" } ],
  // Assigning inside a condition is a valid terse pattern; the rule prevents
  // typos but rejects intentional uses too.
  "no-cond-assign": "off",
  // Named top-level helpers are `function` declarations (hoisted, so call-order
  // reads top-down). Arrows remain for callbacks, dispatch values, and closures.
  "func-style": [ "error", "declaration", { allowArrowFunctions: false } ],
  "camelcase": [ "error", { properties: "never", ignoreDestructuring: true } ],
  "id-length": [ "error", { min: 2, exceptions: [ "i", "j", "x", "y", "a", "b", "_", "fn", "ms", "id" ] } ],
  "id-denylist": [
    "error",
    "e", "evt", "ev", "el", "elem", "btn", "msg", "ctrl", "tgt",
    "str", "num", "idx", "tmp", "obj", "arr", "ctx", "cb", "req", "res", "val", "diff"
  ],
  "no-empty-function": [ "error", { allow: [ "methods" ] } ],
  "grouped-accessor-pairs": [ "error", "getBeforeSet" ],
  "prefer-destructuring": [ "error", { object: true, array: false } ],
  "capitalized-comments": [ "error", "always", { ignoreConsecutiveComments: true, ignorePattern: "^[a-z]+:" } ],
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
