import globals from "globals"
import { STACK_FILES } from "#constants/files"
import { enableRules } from "#helpers/eslint/config"
import callbacksystems from "#rules"
import { orderMembers } from "#order"

export default [
  {
    name: "@callbacksystems/browser",
    files: STACK_FILES,
    languageOptions: { globals: globals.browser },
    plugins: { callbacksystems },
    rules: {
      // Native browser APIs use PascalCase intentionally (Intl.*, etc.).
      "new-cap": "off",
      ...enableRules([
        "no-console",
        // Re-enable DOM-only unicorn rules turned off in /base.
        "unicorn/dom-node-dataset",
        "unicorn/no-document-cookie",
        "unicorn/no-invalid-remove-event-listener",
        "unicorn/prefer-add-event-listener",
        "unicorn/prefer-classlist-toggle",
        "unicorn/prefer-dom-node-append",
        "unicorn/prefer-dom-node-remove",
        "unicorn/prefer-dom-node-text-content",
        "unicorn/prefer-keyboard-event-key",
        "unicorn/prefer-modern-dom-apis",
        "callbacksystems/browser/html-element-suffix",
        "callbacksystems/browser/no-class-selector",
        "callbacksystems/browser/prefer-reflected-aria-properties",
        "callbacksystems/browser/query-selector-suffix"
      ])
    }
  },
  ...orderMembers({ files: STACK_FILES })
]
