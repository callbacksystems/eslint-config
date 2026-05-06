import { enableRules } from "#helpers/config"

export default [
  {
    languageOptions: { globals: { Turbo: "readonly" } },
    rules: enableRules([
      "callbacksystems/turbo/no-render-stream-message",
      "callbacksystems/turbo/no-stream-accept-header"
    ])
  }
]
