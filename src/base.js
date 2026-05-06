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
    settings: {
      "import-x/resolver-next": [ createTypeScriptImportResolver() ],
      // To read a dependency's exports, import-x reuses the importing file's parser. Under a stack parser
      // (svelte/astro) that parser chokes on a plain .js module, so pin .js back to the JS parser.
      "import-x/parsers": { espree: [ ".js", ".jsx", ".mjs", ".cjs" ] }
    },
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
  },
  {
    // `.cjs` is CommonJS by definition: parsing it as an ES module turns every `require`/`module.exports` into a
    // syntax-level surprise. The globals come with `/node`, which is where a `.cjs` file lives in practice.
    name: "@callbacksystems/base/commonjs",
    files: [ "**/*.cjs" ],
    languageOptions: { sourceType: "commonjs" },
    // `strict` is a no-op under `sourceType: "module"` and a `"use strict"` banner on every tool config file is
    // not what enabling it was for.
    rules: { strict: "off" }
  },
  {
    // Test files are flat cases (a RuleTester table, a list of `it` blocks), so their length isn't the decomposition
    // signal `max-lines` measures in source.
    files: [ "**/*.{test,spec}.{cjs,js,jsx,mjs}", "**/{__tests__,test,tests,spec}/**/*.{cjs,js,jsx,mjs,svelte,astro}" ],
    rules: { "max-lines": "off" }
  }
]
