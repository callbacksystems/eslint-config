import jsxA11y from "eslint-plugin-jsx-a11y"
import reactBase from "#internal/react_base"
import { COMPONENT_FILENAME_CASES, REACT_FILES } from "#constants/files"

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
      "unicorn/filename-case": [ "error", { cases: COMPONENT_FILENAME_CASES } ]
    }
  }
]
