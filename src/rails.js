import { enableRules } from "#helpers/config"

export default [
  {
    rules: {
      // Importmap-rails is the source of truth for module resolution; ESLint
      // cannot parse Ruby and would flag every bare import otherwise.
      "import-x/no-unresolved": "off",
      ...enableRules([ "callbacksystems/rails/no-csrf-token-access" ])
    }
  }
]
