import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript"
import js from "@eslint/js"
import stylistic from "@stylistic/eslint-plugin"
import sonarjs from "eslint-plugin-sonarjs"
import unicorn from "eslint-plugin-unicorn"
import { importX } from "eslint-plugin-import-x"
import perfectionist from "eslint-plugin-perfectionist"
import { IGNORED_FILES, STACK_FILES, TEST_FILES } from "#constants/files"
import callbacksystems from "#rules"
import { callbacksystemsRules } from "#internal/base_rules/callbacksystems"
import { complexityRules } from "#internal/base_rules/complexity"
import { coreRules } from "#internal/base_rules/core"
import { importRules } from "#internal/base_rules/import"
import { perfectionistRules } from "#internal/base_rules/perfectionist"
import { sonarjsRules } from "#internal/base_rules/sonarjs"
import { styleRules } from "#internal/base_rules/style"
import { unicornRules } from "#internal/base_rules/unicorn"
import { VirtualModulesResolver } from "#helpers/eslint/virtual_modules_resolver"

export default [
  { name: "@callbacksystems/base/ignores", ignores: IGNORED_FILES },
  sonarjs.configs.recommended,
  unicorn.configs.recommended,
  {
    name: "@callbacksystems/base",
    files: STACK_FILES,
    plugins: { "@stylistic": stylistic, "import-x": importX, callbacksystems, perfectionist },
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    // A rule that fights the code is telling you something about the code, so there is no silencing one line at a time.
    linterOptions: { noInlineConfig: true, reportUnusedInlineConfigs: "error" },
    settings: {
      "import-x/resolver-next": [ new VirtualModulesResolver(), createTypeScriptImportResolver() ],
      // To read a dependency, import-x reuses the importing file's parser, and a svelte/astro parser chokes on a plain
      // .js module.
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
    // The CommonJS globals come with `/node`, which is where a `.cjs` file lives in practice.
    name: "@callbacksystems/base/commonjs",
    files: [ "**/*.cjs" ],
    languageOptions: { sourceType: "commonjs" },
    // A `"use strict"` banner on every tool config file is not what enabling `strict` was for.
    rules: { strict: "off" }
  },
  {
    // Test files are flat case tables, so their length is not the decomposition signal `max-lines` measures.
    name: "@callbacksystems/base/tests",
    files: TEST_FILES,
    rules: {
      "max-lines": "off",
      // Replacing a global is how a runner installs a fake timer or a fetch stub.
      "unicorn/no-global-object-property-assignment": "off",
      // An `http://` URL in a test is an input worth covering rather than a link to fix.
      "unicorn/prefer-https": "off"
    }
  }
]
