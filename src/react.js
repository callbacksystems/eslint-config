import jsxA11y from "eslint-plugin-jsx-a11y"
import reactBase, { REACT_FILES } from "#internal/react-base"

export default [
  ...reactBase,
  {
    name: "@callbacksystems/react",
    files: REACT_FILES,
    plugins: { "jsx-a11y": jsxA11y },
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      "jsx-a11y/no-autofocus": "off",
      "max-lines-per-function": [ "error", { max: 100, skipBlankLines: true, skipComments: true } ],
      // Guard-clause + JSX return is the canonical React pattern; collapsing to a ternary fights it.
      "callbacksystems/prefer-ternary-return": "off",
      // Components are PascalCase, utilities snake_case.
      "unicorn/filename-case": [ "error", { cases: { snakeCase: true, pascalCase: true } } ]
    }
  }
]
