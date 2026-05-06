import expo from "eslint-plugin-expo"
import globals from "globals"
import { enableRules } from "#helpers/config"
import reactBase from "#internal/react-base"

export default [
  ...reactBase,
  {
    files: [ "**/*.{cjs,js,jsx,mjs}" ],
    plugins: { expo },
    languageOptions: {
      globals: {
        ...globals.node,
        // RN-only globals not present in node or browser sets.
        __DEV__: "readonly",
        cancelAnimationFrame: "readonly",
        cancelIdleCallback: "readonly",
        ErrorUtils: "readonly",
        requestAnimationFrame: "readonly",
        requestIdleCallback: "readonly",
        XMLHttpRequest: "readonly"
      }
    },
    rules: {
      ...enableRules([
        "expo/no-dynamic-env-var",
        "expo/no-env-var-destructuring",
        "expo/prefer-box-shadow",
        "expo/use-dom-exports"
      ]),
      // HTML-specific React rule that does not apply to native views.
      "react/no-unknown-property": "off"
    }
  }
]
