export const unicornRules = {
  // Only require switch-case braces when scope is needed (let/const inside).
  "unicorn/switch-case-braces": [ "error", "avoid" ],
  // Only suggest ternary when both branches fit on one line; multi-line
  // branches lose readability.
  "unicorn/prefer-ternary": [ "error", "only-single-line" ],
  // Anonymous default exports are fine when the filename gives context.
  "unicorn/no-anonymous-default-export": "off",
  // Functional preferences that clash with OO style.
  "unicorn/no-array-callback-reference": "off",
  "unicorn/no-array-for-each": "off",
  "unicorn/no-array-reduce": "off",
  "unicorn/no-array-reverse": "off",
  "unicorn/no-array-sort": "off",
  "unicorn/no-instanceof-builtins": "off",
  "unicorn/prefer-prototype-methods": "off",
  "unicorn/prefer-reflect-apply": "off",
  "unicorn/prefer-spread": "off",
  // `null` is fine.
  "unicorn/no-null": "off",
  // CLI scripts legitimately call process.exit().
  "unicorn/no-process-exit": "off",
  // TODOs without expiry dates are normal.
  "unicorn/expiring-todo-comments": "off",
  // Conflicts with sonarjs/no-global-this; native `window` is fine in browser apps.
  "unicorn/prefer-global-this": "off",
  // Snake_case for all source files.
  "unicorn/filename-case": [ "error", { case: "snakeCase" } ],
  // Numeric separators (1_000_000) are visually nice but screen readers handle them poorly.
  "unicorn/numeric-separators-style": "off",
  // DOM-only rules; re-enabled in /browser.
  "unicorn/no-document-cookie": "off",
  "unicorn/no-invalid-remove-event-listener": "off",
  "unicorn/prefer-add-event-listener": "off",
  "unicorn/prefer-classlist-toggle": "off",
  "unicorn/prefer-dom-node-append": "off",
  "unicorn/prefer-dom-node-dataset": "off",
  "unicorn/prefer-dom-node-remove": "off",
  "unicorn/prefer-dom-node-text-content": "off",
  "unicorn/prefer-keyboard-event-key": "off",
  "unicorn/prefer-modern-dom-apis": "off",
  "unicorn/prefer-query-selector": "off",
  // Extras not in unicorn recommended.
  "unicorn/consistent-destructuring": "error",
  "unicorn/custom-error-definition": "error",
  "unicorn/no-unused-properties": "error",
  // Allow `Props` (React vocabulary), `params` (universal), `arg`/`args` (rule names).
  "unicorn/prevent-abbreviations": [ "error", {
    allowList: {
      Props: true,
      Prop: true,
      params: true,
      Params: true,
      Param: true,
      args: true,
      Args: true,
      Arg: true,
      arg: true
    }
  } ]
}
