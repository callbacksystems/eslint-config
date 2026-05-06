import svelte from "eslint-plugin-svelte"

export default [
  ...svelte.configs.recommended,
  {
    files: [ "**/*.svelte", "**/*.svelte.js" ],
    languageOptions: { parserOptions: { extraFileExtensions: [ ".svelte" ] } },
    rules: {
      // Script consts are presentation and reactive-state variables, not configuration constants, so
      // SCREAMING_SNAKE_CASE does not apply.
      "callbacksystems/constant-naming": "off",
      // `svelte` and `svelte/reactivity` are distinct runtime modules whose types both resolve to
      // svelte/types/index.d.ts, so no-duplicates (which dedupes by resolved type file) reports a false duplicate. They
      // can't be merged: SvelteSet and friends live only in svelte/reactivity.
      "import-x/no-duplicates": "off",
      // Components are PascalCase (`Button.svelte`); modules are snake_case.
      "unicorn/filename-case": [ "error", { cases: { snakeCase: true, pascalCase: true } } ]
    }
  }
]
