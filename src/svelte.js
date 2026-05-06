import svelte from "eslint-plugin-svelte"
import { COMPONENT_FILENAME_CASES } from "#constants/files"

export default [
  ...svelte.configs.recommended,
  {
    name: "@callbacksystems/svelte",
    files: [ "**/*.svelte", "**/*.svelte.js" ],
    languageOptions: { parserOptions: { extraFileExtensions: [ ".svelte" ] } },
    rules: {
      // Script consts are presentation and reactive-state variables, not configuration constants.
      "callbacksystems/constant-naming": "off",
      // `svelte` and `svelte/reactivity` are distinct runtime modules whose types resolve to one `.d.ts`, which reads
      // as a false duplicate.
      "import-x/no-duplicates": "off",
      // A `$state` rune lives in module scope and is assigned from every handler that updates it.
      "unicorn/no-top-level-assignment-in-function": "off",
      "unicorn/filename-case": [ "error", { cases: COMPONENT_FILENAME_CASES } ]
    }
  }
]
