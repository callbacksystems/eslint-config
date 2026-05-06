import globals from "globals"
import base from "#base"

export default [
  ...base,
  {
    files: [ "**/*.{cjs,js,jsx,mjs,ts,tsx}" ],
    languageOptions: {
      globals: { ...globals.node }
    }
  }
]
