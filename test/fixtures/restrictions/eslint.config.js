import { restrictGlobals, restrictImports, restrictSyntax } from "#restrictions"

export default [
  ...restrictImports({
    files: [ "**/*.js" ],
    paths: [
      {
        name: "lodash",
        message: "Use native helpers.",
        allowedIn: [ "allowed/**" ]
      },
      {
        name: "react",
        importNames: [ "createContext" ],
        message: "No Context."
      },
      {
        name: "internal",
        message: "Components must not reach into `internal/`.",
        restrictedTo: [ "components/**" ],
        allowedIn: [ "components/auth/**" ]
      }
    ]
  }),
  ...restrictGlobals({
    files: [ "**/*.js" ],
    globals: [
      { name: "alert", message: "Use a real dialog." },
      { name: "confirm", message: "Use `confirmDialog`.", allowedIn: [ "dialogs/**" ] },
      { name: "prompt", message: "Components only.", restrictedTo: [ "components/**" ] }
    ]
  }),
  ...restrictSyntax({
    files: [ "**/*.js" ],
    selectors: [
      {
        selector: "CallExpression[callee.name='fetch']",
        message: "Route through API."
      },
      {
        selector: "CallExpression[callee.property.name='toLocaleString']",
        message: "Use formatter.",
        allowedIn: [ "lib/i18n/**" ]
      },
      {
        selector: "CallExpression[callee.name='setTimeout']",
        message: "Components only.",
        restrictedTo: [ "components/**" ]
      }
    ]
  })
]
