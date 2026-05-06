import { STIMULUS_NAME_GROUPS } from "#constants/member_groups"
import { enableRules } from "#helpers/config"

export default [
  {
    name: "@callbacksystems/stimulus",
    rules: {
      ...enableRules([
        "callbacksystems/stimulus/action-naming",
        "callbacksystems/stimulus/controller-shape",
        "callbacksystems/stimulus/no-imperative-event-listener",
        "callbacksystems/stimulus/no-instance-state-assignment",
        "callbacksystems/stimulus/no-manual-static-attribute-query",
        "callbacksystems/stimulus/prefer-dispatch",
        "callbacksystems/stimulus/static-config-keys-camelcase",
        "callbacksystems/stimulus/use-has-target-getter"
      ]),
      "callbacksystems/step-down-methods": [ "error", { nameGroups: STIMULUS_NAME_GROUPS } ]
    }
  },
  {
    // Only a controller keeps its getters below its actions, and the file name is what registers one as a controller.
    name: "@callbacksystems/stimulus/controllers",
    files: [ "**/*_controller.js" ],
    rules: {
      "callbacksystems/step-down-methods": [ "error", { nameGroups: STIMULUS_NAME_GROUPS, separateAccessors: true } ]
    }
  }
]
