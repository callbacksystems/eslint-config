import { importX } from "eslint-plugin-import-x"
import { enableRules } from "#helpers/config"

export const importRules = {
  ...importX.configs["flat/recommended"].rules,
  ...enableRules([
    "import-x/no-duplicates",
    "import-x/no-named-as-default",
    "import-x/no-named-as-default-member",
    "import-x/first",
    "import-x/no-absolute-path",
    "import-x/no-mutable-exports",
    "import-x/no-self-import",
    "import-x/no-useless-path-segments"
  ]),
  "import-x/no-cycle": [ "error", { maxDepth: 8 } ],
  // `ignorePackages` stops the rule asking for an extension, not forbidding one, and a package's `exports` map decides
  // whether `pkg/locale/es.js` resolves with the suffix. So the policy runs on the paths the project resolves itself.
  "import-x/extensions": [ "error", "ignorePackages", {
    pattern: { cjs: "never", js: "never", jsx: "never", mjs: "never", svelte: "always", astro: "always" },
    pathGroupOverrides: [
      { pattern: "{.,..}/**", action: "enforce" },
      { pattern: "{@,~}/**", action: "enforce" },
      { pattern: "**", action: "ignore" }
    ]
  } ],
  "import-x/order": [ "error", {
    groups: [ "builtin", "external", "internal", "parent", "sibling", "index" ],
    // A scheme marks a module the platform hands you rather than one npm installs, so it belongs with the builtins.
    // Nothing is excluded, since the imports being moved are the ones import-x already classified as external.
    pathGroups: [ { pattern: "*:**", group: "builtin" } ],
    pathGroupsExcludedImportTypes: [],
    "newlines-between": "never"
  } ]
}
