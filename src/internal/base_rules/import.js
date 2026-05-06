import { importX } from "eslint-plugin-import-x"
import { enableRules } from "#helpers/eslint/config"

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
  // `ignorePackages` only stops the rule asking for an extension, and a package's `exports` map decides whether one
  // resolves, so the policy runs on the paths the project resolves itself.
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
    // A `scheme:` module is handed over by the platform, so it sorts with the builtins. Nothing is excluded, since
    // these imports are the ones import-x classifies as external.
    pathGroups: [ { pattern: "*:**", group: "builtin" } ],
    pathGroupsExcludedImportTypes: [],
    "newlines-between": "never"
  } ]
}
