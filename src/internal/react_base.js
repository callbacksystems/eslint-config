// Scoping JSX parsing to `.jsx` rather than to every `.js` is what keeps components out of `.js`: JSX there fails to
// parse on the exact line. Parsing everywhere would let a component in `.js` lint clean while no React rule saw it.

import react from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import stylistic from "@stylistic/eslint-plugin"
import { REACT_FILES } from "#constants/files"
import { enableRules } from "#helpers/config"

export default [
  {
    name: "@callbacksystems/react/core",
    files: REACT_FILES,
    plugins: { "@stylistic": stylistic, "react-hooks": reactHooks, react },
    settings: { react: { version: "19" } },
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs["recommended-latest"].rules,

      "@stylistic/jsx-indent-props": [ "error", 2 ],
      "react/jsx-no-bind": [ "error", { allowArrowFunctions: true } ],
      "react/prop-types": "off",
      // `if (!user) return null` before the JSX is how a component bails out. Wrapping it positively, folding it into a
      // ternary, or inverting the tail all bury the markup one level deeper for nothing.
      "callbacksystems/prefer-positive-wrap": "off",
      "callbacksystems/prefer-tail-condition": "off",
      "callbacksystems/prefer-ternary-return": "off",

      ...enableRules([
        "react/default-props-match-prop-types",
        "react/no-multi-comp",
        "react/hook-use-state",
        "react/jsx-child-element-spacing",
        "react/jsx-no-constructed-context-values",
        "react/jsx-no-useless-fragment",
        "react/jsx-pascal-case",
        "react/no-access-state-in-setstate",
        "react/no-array-index-key",
        "react/no-redundant-should-component-update",
        "react/no-this-in-sfc",
        "react/no-unstable-nested-components",
        "react/no-unused-class-component-methods",
        "react/no-unused-prop-types"
      ])
    }
  }
]
