import { enableRules } from "#helpers/eslint/config"

export const styleRules = {
  "@stylistic/array-bracket-spacing": [ "error", "always" ],
  "@stylistic/arrow-spacing": [ "error", { before: true, after: true } ],
  "@stylistic/block-spacing": [ "error", "always" ],
  "@stylistic/comma-dangle": [ "error", "never" ],
  "@stylistic/comma-spacing": [ "error", { before: false, after: true } ],
  "@stylistic/comma-style": [ "error", "last" ],
  "@stylistic/computed-property-spacing": [ "error", "never" ],
  "@stylistic/function-call-spacing": [ "error", "never" ],
  "@stylistic/indent": [ "error", 2, { SwitchCase: 1 } ],
  // `@stylistic/indent` skips the operands of multiline `&&`/`||`/binary expressions.
  "@stylistic/indent-binary-ops": [ "error", 2 ],
  "@stylistic/key-spacing": [ "error", { beforeColon: false, afterColon: true } ],
  "@stylistic/max-len": [ "error", { code: 120 } ],
  "@stylistic/multiline-comment-style": [ "error", "separate-lines" ],
  "@stylistic/no-multiple-empty-lines": [ "error", { max: 1, maxBOF: 0, maxEOF: 0 } ],
  "@stylistic/nonblock-statement-body-position": [ "error", "beside" ],
  "@stylistic/object-curly-spacing": [ "error", "always" ],
  "@stylistic/quotes": [ "error", "double", { avoidEscape: true } ],
  "@stylistic/semi": [ "error", "never" ],
  "@stylistic/spaced-comment": [ "error", "always" ],
  "@stylistic/multiline-ternary": [ "error", "always-multiline" ],
  "@stylistic/lines-around-comment": [ "error", { beforeBlockComment: true } ],
  "@stylistic/no-mixed-operators": [ "error", { groups: [ [ "&&", "||" ] ] } ],
  "@stylistic/padded-blocks": [ "error", "never" ],
  curly: [ "error", "multi-line" ],
  "prefer-const": [ "error", { destructuring: "all" } ],
  ...enableRules([
    "@stylistic/brace-style",
    "@stylistic/eol-last",
    "@stylistic/keyword-spacing",
    "@stylistic/max-statements-per-line",
    "@stylistic/no-extra-semi",
    "@stylistic/no-multi-spaces",
    "@stylistic/no-trailing-spaces",
    "@stylistic/space-infix-ops",
    "no-var"
  ])
}
