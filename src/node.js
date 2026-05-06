import globals from "globals"
import base from "#base"

export default [
  ...base,
  {
    files: [ "**/*.{cjs,js,jsx,mjs}" ],
    languageOptions: { globals: { ...globals.node } }
  }
]
