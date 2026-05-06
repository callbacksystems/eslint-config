import { enableRules } from "#helpers/config"

export const unicornRules = {
  // Only require switch-case braces when scope is needed (let/const inside).
  "unicorn/switch-case-braces": [ "error", "avoid" ],
  // Only suggest ternary when both branches fit on one line; multi-line branches lose readability.
  "unicorn/prefer-ternary": [ "error", "only-single-line" ],
  // Anonymous default exports are fine when the filename gives context.
  "unicorn/no-anonymous-default-export": "off",
  // Functional preferences that clash with OO style.
  "unicorn/no-array-callback-reference": "off",
  // We prefer `.forEach()` over `for...of` (see `callbacksystems/prefer-for-each`), the opposite of this unicorn rule.
  "unicorn/no-for-each": "off",
  "unicorn/no-array-reduce": "off",
  "unicorn/no-array-reverse": "off",
  "unicorn/no-array-sort": "off",
  "unicorn/no-instanceof-builtins": "off",
  "unicorn/prefer-prototype-methods": "off",
  "unicorn/prefer-reflect-apply": "off",
  "unicorn/prefer-spread": "off",
  "unicorn/no-null": "off",
  // CLI scripts legitimately call process.exit().
  "unicorn/no-process-exit": "off",
  // TODOs without expiry dates are normal.
  "unicorn/expiring-todo-comments": "off",
  // Conflicts with sonarjs/no-global-this; native `window` is fine in browser apps.
  "unicorn/prefer-global-this": "off",
  // Same chains as `callbacksystems/prefer-switch-over-if-chain`, whose fix keeps this preset's brace and indent style.
  "unicorn/prefer-switch": "off",
  // Same ternaries as `callbacksystems/prefer-minimal-ternary`, which leaves translation calls alone: an i18n key has
  // to stay a literal the locale extractor can read.
  "unicorn/prefer-minimal-ternary": "off",
  // Members read top-down, public first (see `callbacksystems/step-down-methods`), not privates first.
  "unicorn/consistent-class-member-order": "off",
  // The opposite of `callbacksystems/no-uninitialized-field`. A private field needs its declaration to parse and a
  // subclass is exempt anyway, which leaves declarations that only repeat the assignment below them.
  "unicorn/no-undeclared-class-members": "off",
  // A third-person verb is a legitimate boolean name (see `callbacksystems/boolean-naming`).
  "unicorn/consistent-boolean-name": "off",
  // We wrap the body in a positive conditional instead of inverting it into a guard or a `continue`.
  "unicorn/prefer-early-return": "off",
  "unicorn/prefer-continue": "off",
  // Dropping the `else` leaves a return mid-function, which `callbacksystems/no-mid-function-returns` forbids.
  "unicorn/no-useless-else": "off",
  // `.catch()` as a fallback value is not promise chaining, and a getter cannot await.
  "unicorn/prefer-await": "off",
  // A recursion that walks a tree is not a loop in disguise, and rewriting it as one reads worse.
  "unicorn/no-useless-recursion": "off",
  "unicorn/filename-case": [ "error", { case: "snakeCase" } ],
  // Numeric separators (1_000_000) are visually nice but screen readers handle them poorly.
  "unicorn/numeric-separators-style": "off",
  // DOM-only rules; re-enabled in /browser.
  "unicorn/dom-node-dataset": "off",
  "unicorn/no-document-cookie": "off",
  "unicorn/no-invalid-remove-event-listener": "off",
  "unicorn/prefer-add-event-listener": "off",
  "unicorn/prefer-classlist-toggle": "off",
  "unicorn/prefer-dom-node-append": "off",
  "unicorn/prefer-dom-node-remove": "off",
  "unicorn/prefer-dom-node-text-content": "off",
  "unicorn/prefer-keyboard-event-key": "off",
  "unicorn/prefer-modern-dom-apis": "off",
  "unicorn/prefer-query-selector": "off",
  // Allow `Props` (React vocabulary), `params` (universal), `arg`/`args` (rule names).
  // The `application`/`applications` defaults abbreviate into `app`/`apps`, the opposite of what the rule is for.
  "unicorn/name-replacements": [ "error", {
    replacements: { application: false, applications: false },
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
  } ],
  ...enableRules([
    "unicorn/consistent-destructuring",
    "unicorn/custom-error-definition",
    // Its default style wraps the loop in a positive conditional instead of iterating over `items ?? []`.
    "unicorn/iteration-fallback-style",
    "unicorn/no-unused-properties"
  ])
}
