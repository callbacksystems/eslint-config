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
  // Forbid extensions on local JS files but require them on Svelte/Astro imports (the runtime needs them); always allow
  // extensions on npm packages whose name legitimately ends in .js (e.g. `@rails/request.js`).
  "import-x/extensions": [ "error", "ignorePackages", {
    cjs: "never",
    js: "never",
    jsx: "never",
    mjs: "never",
    svelte: "always",
    astro: "always"
  } ],
  "import-x/order": [ "error", {
    groups: [ "builtin", "external", "internal", "parent", "sibling", "index" ],
    "newlines-between": "never"
  } ]
}
