import astro from "eslint-plugin-astro"

export default [
  ...astro.configs.recommended,
  // Astro template a11y via the plugin's wrapper (uses jsx-a11y rules under
  // `astro/jsx-a11y/*` IDs against the Astro AST).
  ...astro.configs["flat/jsx-a11y-recommended"],
  {
    files: [ "**/*.astro" ],
    rules: {
      // Frontmatter consts are presentation variables (`title`, `items`), not
      // configuration constants, so SCREAMING_SNAKE_CASE does not apply.
      "callbacksystems/constant-naming": "off",
      // Pages are routes (kebab-case) or PascalCase components.
      "unicorn/filename-case": [ "error", { cases: { snakeCase: true, pascalCase: true, kebabCase: true } } ]
    }
  }
]
