import base from "#base"
import browser from "#browser"

export default [
  ...base,
  ...browser,
  {
    languageOptions: {
      globals: { Turbo: "readonly" }
    },
    rules: {
      // Importmap-rails is the source of truth for module resolution and ESLint cannot parse Ruby.
      "import-x/no-unresolved": "off"
    }
  }
]
