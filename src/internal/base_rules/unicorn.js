import { enableRules } from "#helpers/config"

export const unicornRules = {
  "unicorn/switch-case-braces": [ "error", "avoid" ],
  "unicorn/prefer-ternary": [ "error", "only-single-line" ],
  // Anonymous default exports are fine when the filename gives context.
  "unicorn/no-anonymous-default-export": "off",
  // Functional preferences that clash with OO style.
  "unicorn/no-array-callback-reference": "off",
  // The opposite of `callbacksystems/prefer-for-each`.
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
  // `callbacksystems/no-manual-accumulation` covers the loop it looks for and points at `map`, and
  // `callbacksystems/prefer-array-from-mapping` takes the `Array.from(x).map(fn)` shape.
  "unicorn/prefer-array-from-map": "off",
  // `callbacksystems/prefer-minimal-ternary` covers these and leaves an i18n key a literal the extractor can read.
  "unicorn/prefer-minimal-ternary": "off",
  // Members read top-down, public first (see `callbacksystems/step-down-methods`), not privates first.
  "unicorn/consistent-class-member-order": "off",
  // The opposite of `callbacksystems/no-uninitialized-field`, which drops a declaration only repeating an assignment.
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
  // Screen readers handle numeric separators (1_000_000) poorly.
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
  // `Props`, `params` and `arg`/`args` are vocabulary, and the `application` default abbreviates, the opposite of what
  // the rule is for.
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
