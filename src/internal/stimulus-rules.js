import { enableRules } from "#helpers/config"

export const stimulusRules = enableRules([
  "callbacksystems/stimulus/action-naming",
  "callbacksystems/stimulus/controller-shape",
  "callbacksystems/stimulus/static-config-keys-camelcase"
])
