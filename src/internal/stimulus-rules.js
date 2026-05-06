import { enableRules } from "#helpers/config"

export const stimulusRules = enableRules([
  "callbacksystems/stimulus/action-naming",
  "callbacksystems/stimulus/controller-shape",
  "callbacksystems/stimulus/no-imperative-event-listener",
  "callbacksystems/stimulus/no-instance-state-assignment",
  "callbacksystems/stimulus/prefer-dispatch",
  "callbacksystems/stimulus/static-config-keys-camelcase",
  "callbacksystems/stimulus/use-has-target-getter"
])
