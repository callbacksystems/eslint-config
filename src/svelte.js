import svelte from "eslint-plugin-svelte"
import { COMPONENT_FILENAME_CASES } from "#constants/files"

export default [
  ...svelte.configs.recommended,
  {
    name: "@callbacksystems/svelte",
    files: [ "**/*.svelte", "**/*.svelte.js" ],
    languageOptions: { parserOptions: { extraFileExtensions: [ ".svelte" ] } },
    rules: {
      // Script consts are presentation and reactive-state variables, not configuration constants, so
      // SCREAMING_SNAKE_CASE does not apply.
      "callbacksystems/constant-naming": "off",
      // `svelte` and `svelte/reactivity` are distinct runtime modules that can't be merged, but their types both
      // resolve to svelte/types/index.d.ts, so no-duplicates dedupes by that file and reports a false duplicate.
      "import-x/no-duplicates": "off",
      // A `$state` rune lives in the component's module scope, and every handler that updates it assigns from a
      // function, which is the whole point of runes.
      "unicorn/no-top-level-assignment-in-function": "off",
      "unicorn/filename-case": [ "error", { cases: COMPONENT_FILENAME_CASES } ]
    }
  }
]
