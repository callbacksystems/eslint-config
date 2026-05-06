// Astro overlay. Compose with `/base` and `/browser` from the consumer side.

import astro from "eslint-plugin-astro"

export default [
  ...astro.configs.recommended,
  // Astro template a11y via the plugin's wrapper (uses jsx-a11y rules under
  // `astro/jsx-a11y/*` IDs against the Astro AST).
  ...astro.configs["flat/jsx-a11y-recommended"],
  {
    files: [ "**/*.astro" ],
    rules: {
      // Pages are routes (kebab-case) or PascalCase components.
      "unicorn/filename-case": [ "error", { cases: { snakeCase: true, pascalCase: true, kebabCase: true } } ]
    }
  }
]
