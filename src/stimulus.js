import { STIMULUS_NAME_GROUPS } from "#constants/member_groups"
import { enableRules } from "#helpers/config"
import callbacksystems from "#rules"

export default [
  {
    name: "@callbacksystems/stimulus",
    plugins: { callbacksystems },
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
    // The entry point stimulus-rails generates hands the application to the console as `window.Stimulus`, with the two
    // assignments aligned, and the file stays as generated.
    name: "@callbacksystems/stimulus/application",
    files: [ "**/controllers/application.js" ],
    rules: { "@stylistic/no-multi-spaces": "off", "unicorn/no-global-object-property-assignment": "off" }
  },
  {
    // Only a controller keeps its getters below its actions, and the file name is what registers one as a controller.
    // The generator writes `connect() {\n  }` with the brace on its own line, and that stays as generated.
    name: "@callbacksystems/stimulus/controllers",
    files: [ "**/*_controller.js" ],
    plugins: { callbacksystems },
    rules: {
      "callbacksystems/step-down-methods": [ "error", { nameGroups: STIMULUS_NAME_GROUPS, separateAccessors: true } ],
      "unicorn/empty-brace-spaces": "off"
    }
  }
]
