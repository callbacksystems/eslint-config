# Callback ESLint Config

Shared ESLint configuration for Callback Systems projects.

## Installation

```bash
npm install --save-dev @callbacksystems/eslint-config
```

Requires ESLint 10 and Node 24 or newer.

## Subpaths

Each subpath is an **overlay**: it ships only what is unique to that stack and is composed by the consumer alongside `/base` and the relevant environment globals. Each also ignores the directories its own stack generates, so adding `/rails` is what stops `public/` and `tmp/` from being linted.

For what any individual rule does, see [the rule reference](docs/README.md).

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
| `/restrictions` | Enforcing project boundaries (see below) |

## Usage

### Rails / Hotwire / importmap

```js
// eslint.config.js
import base from "@callbacksystems/eslint-config/base"
import browser from "@callbacksystems/eslint-config/browser"
import stimulus from "@callbacksystems/eslint-config/stimulus"
import turbo from "@callbacksystems/eslint-config/turbo"
import rails from "@callbacksystems/eslint-config/rails"

export default [ ...base, ...browser, ...stimulus, ...turbo, ...rails ]
```

### Stimulus (without Rails)

For projects using Stimulus controllers outside Rails (Vite, custom build, etc.):

```js
// eslint.config.js
import base from "@callbacksystems/eslint-config/base"
import browser from "@callbacksystems/eslint-config/browser"
import stimulus from "@callbacksystems/eslint-config/stimulus"

export default [ ...base, ...browser, ...stimulus ]
```

### Astro

```js
// eslint.config.js
import base from "@callbacksystems/eslint-config/base"
import browser from "@callbacksystems/eslint-config/browser"
import astro from "@callbacksystems/eslint-config/astro"

export default [ ...base, ...browser, ...astro ]
```

### React (Vite, etc.)

```js
// eslint.config.js
import base from "@callbacksystems/eslint-config/base"
import browser from "@callbacksystems/eslint-config/browser"
import react from "@callbacksystems/eslint-config/react"

export default [ ...base, ...browser, ...react ]
```

Components go in `.jsx`. JSX in a `.js` file is a parse error on purpose: that is what keeps a component from linting clean while no React or hooks rule ever looks at it.

### React Native (Expo)

```js
// eslint.config.js
import base from "@callbacksystems/eslint-config/base"
import reactNative from "@callbacksystems/eslint-config/react-native"

export default [ ...base, ...reactNative ]
```

This preset replaces `eslint-config-expo`. Don't install both.

### Svelte (Svelte 5 / SvelteKit)

```js
// eslint.config.js
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

Use the helpers from `/restrictions` to enforce project boundaries: keep imports going through barrels, route network calls through a single client, prevent direct use of certain globals, etc.

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
        message: "Import icons from `src/components/ui/icons` instead.",
        allowedIn: [ "src/components/ui/icons.js" ]
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
    files: [ "src/**/*.{js,jsx}" ],
    globals: [
      {
        name: "alert",
        message: "Use `setStatus` from `src/lib/status`.",
        allowedIn: [ "src/lib/status.js" ]
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
    files: [ "src/**/*.{js,jsx}" ],
    selectors: [
      {
        selector: "CallExpression[callee.name='fetch']",
        message: "Route network calls through `src/lib/api/client`.",
        allowedIn: [ "src/lib/api/client.js" ]
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

Within one call, overlapping `restrictedTo` scopes are safe: a file that falls into several of them keeps the restrictions from all of them.

## Customizing

### Custom globals

Add project-specific globals (third-party scripts, environment variables exposed to the client, etc.):

```js
export default [
  ...base,
  ...browser,
  ...stimulus,
  ...turbo,
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
  ...base,
  ...browser,
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
  ...base,
  ...browser,
  ...react,
  {
    plugins: { myproject: myProjectRules },
    rules: { "myproject/no-something": "error" }
  }
]
```

## Development

```bash
npm ci
npm run lint   # the plugin on itself
npm test
```

## License

MIT
