import { enableRules } from "#helpers/config"
import callbacksystems from "#rules"

export default [
  {
    name: "@callbacksystems/turbo",
    languageOptions: { globals: { Turbo: "readonly" } },
    plugins: { callbacksystems },
    rules: enableRules([
      "callbacksystems/turbo/no-render-stream-message",
      "callbacksystems/turbo/no-stream-accept-header"
    ])
  }
]
