export const DEFAULT_FILES = [ "**/*.{cjs,js,jsx,mjs}" ]

export const STACK_FILES = [ "**/*.{cjs,js,jsx,mjs,svelte,astro}" ]

export const REACT_FILES = [ "**/*.jsx" ]

// A runner's setup file installs its shims, so it counts as a test file rather than as source.
export const TEST_FILES = [
  "**/*.{test,spec}.{cjs,js,jsx,mjs}",
  "**/{__tests__,test,tests,spec}/**/*.{cjs,js,jsx,mjs,svelte,astro}",
  "**/{jest,vitest}.setup.{cjs,js,mjs}"
]

// Only what every project has, since ignoring what a single stack generates belongs to that stack's preset.
export const IGNORED_FILES = [ "coverage/**", "dist/**", "node_modules/**" ]

// Component files carry the component's own name, so PascalCase joins the snake_case the rest of the repo uses.
export const COMPONENT_FILENAME_CASES = { snakeCase: true, pascalCase: true }
