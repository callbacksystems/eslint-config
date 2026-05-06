# Callback ESLint Config

Shared ESLint configuration for Callback Systems projects.

## Installation

```bash
npm install --save-dev @callbacksystems/eslint-config
```

Requires ESLint 10.

## Subpaths

| Subpath | Description |
|---|---|
| `/rails` | Rails with Hotwire / importmap (vanilla JS) |
| `/react` | React (Astro, Vite, etc.) |
| `/react-native` | Expo / React Native |
| `/base` | Plain JavaScript, no environment globals |
| `/browser` | Browser globals and DOM rules |
| `/node` | Node globals (CLI tools, scripts, servers) |
| `/edge` | Cloudflare Workers globals |
| `/typescript` | typescript-eslint type-checked rules |

## Usage

### Rails / Hotwire / importmap

```js
// eslint.config.js
import rails from "@callbacksystems/eslint-config/rails"

export default [ ...rails ]
```

### React (Astro / Vite)

```js
// eslint.config.js
import react from "@callbacksystems/eslint-config/react"

export default [ ...react ]
```

### React Native (Expo)

```js
// eslint.config.js
import reactNative from "@callbacksystems/eslint-config/react-native"

export default [ ...reactNative ]
```

This preset replaces `eslint-config-expo`. Don't install both.

## Architectural restrictions

Use the helpers from `/restrictions` to enforce project boundaries: keep imports going through barrels, route network calls through a single client, prevent direct use of certain globals, etc.

```js
import react from "@callbacksystems/eslint-config/react"
import { restrictImports, restrictGlobals, restrictSyntax } from "@callbacksystems/eslint-config/restrictions"

export default [
  ...react,

  ...restrictImports({
    files: [ "src/**/*.{ts,tsx}" ],
    paths: [
      {
        name: "lucide-react",
        message: "Import icons from `src/components/ui/icons` instead.",
        allowedIn: [ "src/components/ui/icons.ts" ]
      },
      {
        name: "@azure/msal-browser",
        message: "Import MSAL only from `src/lib/auth`.",
        allowedIn: [ "src/lib/auth/**" ]
      },
      // Restriction with a tighter scope than the file selector above.
      {
        name: "react",
        importNames: [ "createContext", "useContext" ],
        message: "Use a store or hook instead of React Context.",
        restrictedTo: [ "src/components/**", "src/stores/**" ],
        allowedIn: [ "src/components/ui/**" ]
      }
    ]
  }),

  ...restrictGlobals({
    files: [ "src/**/*.{ts,tsx}" ],
    globals: [
      {
        name: "alert",
        message: "Use `setStatus` from `src/lib/status`.",
        allowedIn: [ "src/lib/status.ts" ]
      },
      {
        name: "confirm",
        message: "Use `confirmDialog` from `src/lib/dialogs`.",
        allowedIn: [ "src/lib/dialogs/**" ]
      },
      {
        name: "prompt",
        message: "Use `promptDialog` from `src/lib/dialogs`.",
        allowedIn: [ "src/lib/dialogs/**" ]
      }
    ]
  }),

  ...restrictSyntax({
    files: [ "src/**/*.{ts,tsx}" ],
    selectors: [
      {
        selector: "CallExpression[callee.name='fetch']",
        message: "Route network calls through `src/lib/api/client`.",
        allowedIn: [ "src/lib/api/client.ts" ]
      },
      {
        selector: "CallExpression[callee.property.name='toLocaleDateString']",
        message: "Use a formatter from `src/lib/i18n/date`.",
        allowedIn: [ "src/lib/i18n/**" ]
      }
    ]
  })
]
```

Combine all restrictions of the same kind into a single helper call, since multiple calls of the same helper replace each other.

## Customizing

### Custom globals

Add project-specific globals (third-party scripts, environment variables exposed to the client, etc.):

```js
export default [
  ...rails,
  {
    languageOptions: {
      globals: { Stripe: "readonly" }
    }
  }
]
```

### React version

`/react` and `/react-native` default to React 19. Override per project:

```js
export default [
  ...react,
  {
    settings: { react: { version: "18.2" } }
  }
]
```

### Custom rules

If you ship your own ESLint rules in your project, register them under your own plugin namespace:

```js
import myProjectRules from "./eslint-rules/index.js"

export default [
  ...react,
  {
    plugins: { myproject: myProjectRules },
    rules: { "myproject/no-something": "error" }
  }
]
```

## License

MIT
