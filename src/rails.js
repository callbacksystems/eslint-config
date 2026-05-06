import { enableRules } from "#helpers/eslint/config"
import callbacksystems from "#rules"
import { usesImportmapRails } from "#helpers/eslint/importmap_rails"

export default [
  {
    // Rails writes into these, and any JavaScript under `app/views` is generated or inlined in ERB.
    name: "@callbacksystems/rails/ignores",
    ignores: [ "app/views/**", "log/**", "public/**", "storage/**", "tmp/**", "vendor/**" ]
  },
  {
    name: "@callbacksystems/rails",
    plugins: { callbacksystems },
    rules: {
      // Under importmap the map resolves bare imports and ESLint cannot read Ruby, so every one would be flagged.
      ...(usesImportmapRails() && { "import-x/no-unresolved": "off" }),
      ...enableRules([ "callbacksystems/rails/no-manual-csrf" ])
    }
  }
]
