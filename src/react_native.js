import expo from "eslint-plugin-expo"
import globals from "globals"
import { COMPONENT_FILENAME_CASES, DEFAULT_FILES, REACT_FILES, TEST_FILES } from "#constants/files"
import { enableRules } from "#helpers/config"
import reactBase from "#internal/react_base"

const ROUTE_PREFIX = /^\+/u

export default [
  { name: "@callbacksystems/react_native/ignores", ignores: [ ".expo/**", ".expo-shared/**" ] },
  ...reactBase,
  {
    name: "@callbacksystems/react_native",
    files: DEFAULT_FILES,
    plugins: { expo },
    languageOptions: {
      globals: {
        ...globals.node,
        // RN-only globals not present in node or browser sets.
        __DEV__: "readonly",
        cancelAnimationFrame: "readonly",
        cancelIdleCallback: "readonly",
        ErrorUtils: "readonly",
        requestAnimationFrame: "readonly",
        requestIdleCallback: "readonly",
        XMLHttpRequest: "readonly"
      }
    },
    rules: {
      ...enableRules([
        "expo/no-dynamic-env-var",
        "expo/no-env-var-destructuring",
        "expo/prefer-box-shadow",
        "expo/use-dom-exports"
      ]),
      // HTML-specific React rule that does not apply to native views.
      "react/no-unknown-property": "off",
      // No browserslist target describes Hermes, so the rule ends up measuring the polyfills against whatever Node runs
      // ESLint.
      "unicorn/no-unnecessary-polyfills": "off",
      // Expo Router reserves the `+` prefix for its own routes (`+not-found`, `+html`), which cannot be renamed. Its
      // other conventions (`[id]`, `(tabs)`, `_layout`) already read as snake case.
      "unicorn/filename-case": [ "error", { case: "snakeCase", ignore: [ ROUTE_PREFIX ] } ]
    }
  },
  {
    // A component file carries its component's name here as much as it does on the web.
    name: "@callbacksystems/react_native/components",
    files: REACT_FILES,
    rules: { "unicorn/filename-case": [ "error", { cases: COMPONENT_FILENAME_CASES, ignore: [ ROUTE_PREFIX ] } ] }
  },
  {
    // A layout hands Expo Router its settings through an export the framework looks up by name, next to the component
    // it also looks up, and the underscore is part of that name. Routes live where Expo now puts them.
    name: "@callbacksystems/react_native/layouts",
    files: [ "src/app/**/_layout.{js,jsx}" ],
    rules: {
      camelcase: [ "error", { properties: "never", ignoreDestructuring: true, allow: [ "unstable_settings" ] } ],
      "callbacksystems/no-mixed-exports": "off"
    }
  },
  {
    // Expo generates a local native module as a kebab-case directory, its files included.
    name: "@callbacksystems/react_native/modules",
    files: [ "modules/**/*.{cjs,js,jsx,mjs}" ],
    rules: { "unicorn/filename-case": [ "error", { cases: { kebabCase: true, snakeCase: true } } ] }
  },
  {
    // Expo ships its own Jest preset, so the runner is settled here in a way it is not on the web.
    name: "@callbacksystems/react_native/tests",
    files: TEST_FILES,
    languageOptions: { globals: globals.jest }
  }
]
