// Shared by /react and /react-native. Not exported via package.json.
//
// Components live in `.jsx`. Scoping JSX parsing here rather than to every `.js` is what enforces that: JSX in a `.js`
// file fails to parse, loudly and on the exact line. Parsing it everywhere would be the worse trade, since a component
// in `.js` would then lint clean while no React or hooks rule ever looked at it.

import react from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import stylistic from "@stylistic/eslint-plugin"
import { enableRules } from "#helpers/config"

export const REACT_FILES = [ "**/*.jsx" ]

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

      ...enableRules([
        "react/default-props-match-prop-types",
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
