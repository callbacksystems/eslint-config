// React Native (Expo) overlay. Compose with `/base` from the consumer side.

import expo from "eslint-plugin-expo"
import globals from "globals"
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
      "expo/no-dynamic-env-var": "error",
      "expo/no-env-var-destructuring": "error",
      "expo/prefer-box-shadow": "error",
      "expo/use-dom-exports": "error",
      // HTML-specific React rule that does not apply to native views.
      "react/no-unknown-property": "off"
    }
  }
]
