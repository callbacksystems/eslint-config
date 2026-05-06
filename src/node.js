import globals from "globals"

export default [
  { name: "@callbacksystems/node", files: [ "**/*.{cjs,js,jsx,mjs}" ], languageOptions: { globals: globals.node } }
]
