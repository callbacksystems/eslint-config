import astro from "eslint-plugin-astro"
import { COMPONENT_FILENAME_CASES } from "#constants/files"

export default [
  { name: "@callbacksystems/astro/ignores", ignores: [ ".astro/**" ] },
  ...astro.configs.recommended,
  // Astro template a11y via the plugin's wrapper (uses jsx-a11y rules under `astro/jsx-a11y/*` IDs against the Astro
  // AST).
  ...astro.configs["jsx-a11y-recommended"],
  {
    name: "@callbacksystems/astro",
    files: [ "**/*.astro" ],
    rules: {
      // Frontmatter consts are presentation variables (`title`, `items`), not configuration constants, so
      // SCREAMING_SNAKE_CASE does not apply.
      "callbacksystems/constant-naming": "off",
      // Pages are routes (kebab-case) or PascalCase components.
      "unicorn/filename-case": [ "error", { cases: { ...COMPONENT_FILENAME_CASES, kebabCase: true } } ]
    }
  }
]
