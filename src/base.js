import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript"
import js from "@eslint/js"
import stylistic from "@stylistic/eslint-plugin"
import sonarjs from "eslint-plugin-sonarjs"
import unicorn from "eslint-plugin-unicorn"
import { importX } from "eslint-plugin-import-x"
import perfectionist from "eslint-plugin-perfectionist"
import callbacksystems from "#rules"
import { callbacksystemsRules } from "#internal/base-rules/callbacksystems"
import { complexityRules } from "#internal/base-rules/complexity"
import { coreRules } from "#internal/base-rules/core"
import { importRules } from "#internal/base-rules/import"
import { perfectionistRules } from "#internal/base-rules/perfectionist"
import { sonarjsRules } from "#internal/base-rules/sonarjs"
import { styleRules } from "#internal/base-rules/style"
import { unicornRules } from "#internal/base-rules/unicorn"
import { ignores } from "#internal/ignores"

export default [
  { ignores },
  sonarjs.configs.recommended,
  unicorn.configs.recommended,
  {
    files: [ "**/*.{cjs,js,jsx,mjs,svelte,astro}" ],
    plugins: { "@stylistic": stylistic, "import-x": importX, callbacksystems, perfectionist },
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    settings: { "import-x/resolver-next": [ createTypeScriptImportResolver() ] },
    rules: {
      ...js.configs.recommended.rules,
      ...coreRules,
      ...styleRules,
      ...complexityRules,
      ...sonarjsRules,
      ...unicornRules,
      ...importRules,
      ...callbacksystemsRules,
      ...perfectionistRules
    }
  }
]
