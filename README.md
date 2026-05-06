# Callback ESLint Config

Shared ESLint configuration for Callback Systems projects.

## Installation

```bash
npm install --save-dev @callbacksystems/eslint-config
```

Requires ESLint 10 and Node 24 or newer.

## Subpaths

Each subpath ships only what is unique to its stack, so you combine it with `/base` and the matching environment. Individual rules are documented in [the rule reference](docs/rules.md).

| Subpath | For |
|---|---|
| `/base` | Every project (required) |
| `/browser` | Code running in a browser |
| `/node` | Code running in Node |
| `/edge` | Code running on Cloudflare Workers |
| `/stimulus` | Stimulus controllers |
| `/turbo` | Turbo |
| `/rails` | Rails with importmap |
| `/astro` | Astro |
| `/react` | React |
| `/react-native` | React Native with Expo |
| `/svelte` | Svelte |
| `/restrictions` | Project boundaries |

## Usage

Every example below is an `eslint.config.js`.

### Rails / Hotwire / importmap

```js
import base from "@callbacksystems/eslint-config/base"
import browser from "@callbacksystems/eslint-config/browser"
import stimulus from "@callbacksystems/eslint-config/stimulus"
import turbo from "@callbacksystems/eslint-config/turbo"
import rails from "@callbacksystems/eslint-config/rails"

export default [ ...base, ...browser, ...stimulus, ...turbo, ...rails ]
```

### Stimulus without Rails

```js
import base from "@callbacksystems/eslint-config/base"
import browser from "@callbacksystems/eslint-config/browser"
import stimulus from "@callbacksystems/eslint-config/stimulus"

export default [ ...base, ...browser, ...stimulus ]
```

### Astro

```js
import base from "@callbacksystems/eslint-config/base"
import browser from "@callbacksystems/eslint-config/browser"
import astro from "@callbacksystems/eslint-config/astro"

export default [ ...base, ...browser, ...astro ]
```

### React

```js
import base from "@callbacksystems/eslint-config/base"
import browser from "@callbacksystems/eslint-config/browser"
import react from "@callbacksystems/eslint-config/react"

export default [ ...base, ...browser, ...react ]
```

Components go in `.jsx`. JSX in a `.js` file is a parse error on purpose, since the React and hooks rules only look at `.jsx`.

### React Native with Expo

```js
import base from "@callbacksystems/eslint-config/base"
import reactNative from "@callbacksystems/eslint-config/react-native"

export default [ ...base, ...reactNative ]
```

This preset replaces `eslint-config-expo`. Don't install both.

### Svelte 5 / SvelteKit

```js
import base from "@callbacksystems/eslint-config/base"
import browser from "@callbacksystems/eslint-config/browser"
import svelte from "@callbacksystems/eslint-config/svelte"

export default [ ...base, ...browser, ...svelte ]
```

### Multi-stack

Overlays compose without duplicating `/base` or `/browser`:

```js
import base from "@callbacksystems/eslint-config/base"
import browser from "@callbacksystems/eslint-config/browser"
import astro from "@callbacksystems/eslint-config/astro"
import svelte from "@callbacksystems/eslint-config/svelte"
import react from "@callbacksystems/eslint-config/react"

export default [ ...base, ...browser, ...astro, ...svelte, ...react ]
```

## Architectural restrictions

The `/restrictions` helpers keep imports, globals, and syntax within the boundaries the project sets.

```js
import base from "@callbacksystems/eslint-config/base"
import browser from "@callbacksystems/eslint-config/browser"
import react from "@callbacksystems/eslint-config/react"
import { restrictImports, restrictGlobals, restrictSyntax } from "@callbacksystems/eslint-config/restrictions"

export default [
  ...base,
  ...browser,
  ...react,

  ...restrictImports({
    files: [ "src/**/*.{js,jsx}" ],
    paths: [
      {
        name: "lucide-react",
        message: "Import icons from `src/helpers/icons` instead.",
        allowedIn: [ "src/helpers/icons.js" ]
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
        message: "Pass props or use a hook instead of React Context.",
        restrictedTo: [ "src/components/**", "src/pages/**" ],
        allowedIn: [ "src/components/ui/**" ]
      }
    ]
  }),

  ...restrictGlobals({
    files: [ "src/**/*.{js,jsx}" ],
    globals: [
      {
        name: "alert",
        message: "Use `setStatus` from `src/helpers/status`.",
        allowedIn: [ "src/helpers/status.js" ]
      },
      {
        name: "confirm",
        message: "Use `confirmDialog` from `src/helpers/dialogs`.",
        allowedIn: [ "src/helpers/dialogs/**" ]
      },
      {
        name: "prompt",
        message: "Use `promptDialog` from `src/helpers/dialogs`.",
        allowedIn: [ "src/helpers/dialogs/**" ]
      }
    ]
  }),

  ...restrictSyntax({
    files: [ "src/**/*.{js,jsx}" ],
    selectors: [
      {
        selector: "CallExpression[callee.name='fetch']",
        message: "Route network calls through `src/lib/api/client`.",
        allowedIn: [ "src/lib/api/client.js" ]
      },
      {
        selector: "CallExpression[callee.property.name='toLocaleDateString']",
        message: "Use a formatter from `src/helpers/date`.",
        allowedIn: [ "src/helpers/date.js" ]
      }
    ]
  })
]
```

Call each helper only once, since a second call replaces the first. Overlapping `restrictedTo` scopes within a call are safe, and a file in several of them keeps every restriction.

## Customizing

Anything after the presets overrides them, so project globals and your own rules go in one trailing block:

```js
import myProjectRules from "./eslint-rules/index.js"

export default [
  ...base,
  ...browser,
  ...react,
  {
    languageOptions: {
      globals: { Stripe: "readonly" }
    },
    plugins: { myproject: myProjectRules },
    rules: { "myproject/no-something": "error" }
  }
]
```

## Development

```bash
npm install
npm run lint
npm test
```

## License

MIT
