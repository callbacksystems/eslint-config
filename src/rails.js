import { enableRules } from "#helpers/config"

export default [
  {
    // Rails writes into these, and `app/views` is templates: whatever JavaScript ends up there is generated or inlined
    // in ERB, not source to lint.
    ignores: [ "app/views/**", "log/**", "public/**", "storage/**", "tmp/**", "vendor/**" ]
  },
  {
    rules: {
      // Importmap-rails is the source of truth for module resolution; ESLint cannot parse Ruby and would flag every
      // bare import otherwise.
      "import-x/no-unresolved": "off",
      ...enableRules([ "callbacksystems/rails/no-csrf-token-access" ])
    }
  }
]
