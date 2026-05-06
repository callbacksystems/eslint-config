import { enableRules } from "#helpers/config"
import { usesImportmapRails } from "#helpers/importmap_rails"

export default [
  {
    // Rails writes into these, and `app/views` is templates: whatever JavaScript ends up there is generated or inlined
    // in ERB, not source to lint.
    name: "@callbacksystems/rails/ignores",
    ignores: [ "app/views/**", "log/**", "public/**", "storage/**", "tmp/**", "vendor/**" ]
  },
  {
    name: "@callbacksystems/rails",
    rules: {
      // Under importmap the map is the source of truth and ESLint cannot read Ruby, so every bare import would be
      // flagged. Under jsbundling they resolve from `node_modules`, and the rule catches typos again.
      ...(usesImportmapRails() && { "import-x/no-unresolved": "off" }),
      ...enableRules([ "callbacksystems/rails/no-csrf-token-access" ])
    }
  }
]
