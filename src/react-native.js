import expo from "eslint-plugin-expo"
import globals from "globals"
import base from "#base"
import reactBase from "#react-base"
import typescript from "#typescript"

export default [
  ...base,
  ...typescript,
  ...reactBase,
  {
    files: [ "**/*.{cjs,js,jsx,mjs,ts,tsx}" ],
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
      "expo/no-dynamic-env-var": "error",
      "expo/no-env-var-destructuring": "error",
      "expo/prefer-box-shadow": "error",
      "expo/use-dom-exports": "error",
      // HTML-specific React rule that does not apply to native views.
      "react/no-unknown-property": "off"
    }
  }
]
