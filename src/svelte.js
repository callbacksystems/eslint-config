// Svelte overlay. Compose with `/base` and `/browser` from the consumer side.

import svelte from "eslint-plugin-svelte"

export default [
  ...svelte.configs.recommended,
  {
    files: [ "**/*.svelte", "**/*.svelte.js" ],
    languageOptions: { parserOptions: { extraFileExtensions: [ ".svelte" ] } },
    rules: {
      // Components are PascalCase (`Button.svelte`); modules are snake_case.
      "unicorn/filename-case": [ "error", { cases: { snakeCase: true, pascalCase: true } } ]
    }
  }
]
