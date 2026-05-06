import globals from "globals"

export default [
  {
    files: [ "**/*.{cjs,js,jsx,mjs}" ],
    languageOptions: { globals: globals.serviceworker }
  }
]
