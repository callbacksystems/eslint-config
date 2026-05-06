# Callback ESLint Config

Shared ESLint configuration for Callback Systems projects.

## Installation

```bash
npm install --save-dev @callbacksystems/eslint-config
```

Requires ESLint 10 and Node 24.16 or newer.

## Subpaths

Each subpath ships only what is unique to its stack, so you combine it with `/base` and the matching environment. Individual rules are documented in [the rule reference](docs/rules.md).

| Subpath | For |
|---|---|
| `/base` | Every project (required) |
| `/browser` | Code running in a browser |
| `/node` | Code running in Node |
| `/cloudflare` | Code running on Cloudflare Workers |
| `/stimulus` | Stimulus controllers |
| `/turbo` | Turbo |
| `/rails` | Rails |
| `/astro` | Astro |
| `/react` | React |
| `/react_native` | React Native with Expo |
| `/svelte` | Svelte |
| `/restrictions` | Project boundaries |
| `/order` | Class member order |

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

`/rails` turns `import-x/no-unresolved` off when the project has a `config/importmap.rb`, since the map owns module resolution and ESLint cannot read it. A project that bundles instead keeps the rule, which is what catches a mistyped path.

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

Components go in `.jsx`. JSX in a `.js` file is a parse error on purpose.

### React Native with Expo

```js
import base from "@callbacksystems/eslint-config/base"
import reactNative from "@callbacksystems/eslint-config/react_native"

export default [ ...base, ...reactNative ]
```

This preset replaces `eslint-config-expo`. Don't install both.

### Svelte 5

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

export default [ ...base, ...browser, ...astro, ...svelte ]
```

### Running it

With the config in place, run ESLint as usual:

```bash
npx eslint
```

Pass `--max-warnings 0` so a build fails on one, since the config turns inline `eslint-disable` directives off and reports an ignored directive as a warning. In your `package.json`:

```json
{
  "scripts": {
    "lint": "eslint --max-warnings 0",
    "lint:fix": "eslint --max-warnings 0 --fix"
  }
}
```

## Architectural restrictions

The `/restrictions` helpers keep imports, globals, syntax, and what each folder exports within the boundaries the project sets.

```js
import base from "@callbacksystems/eslint-config/base"
import browser from "@callbacksystems/eslint-config/browser"
import react from "@callbacksystems/eslint-config/react"
import {
  restrictExports, restrictGlobals, restrictImports, restrictSyntax
} from "@callbacksystems/eslint-config/restrictions"

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
      { name: "alert", message: "Use `setStatus` from `src/helpers/status`.", allowedIn: [ "src/helpers/status.js" ] },
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
  }),

  // What a folder may present: `class`, `function`, `constant` or `reexport`.
  ...restrictExports({ files: [ "src/constants/**/*.js" ], to: [ "constant" ] }),
  ...restrictExports({ files: [ "src/helpers/**/*.js" ], to: [ "function" ] }),
  ...restrictExports({ files: [ "src/models/**/*.js" ], to: [ "class" ] })
]
```

Call `restrictImports`, `restrictGlobals` and `restrictSyntax` only once each, since a second call replaces the first. Overlapping `restrictedTo` scopes within a call are safe, and a file in several of them keeps every restriction.

`restrictExports` works the other way around, taking one glob per call, so call it once per folder. A file matched by two calls keeps the last one.

## Class member order

`/order` pins a set of methods to a fixed place in the class, matching them by name.

The presets already pin the callbacks a browser calls on a custom element, and the ones Stimulus calls on a controller. Use `/order` when those hooks are named by your own code instead, as with a base class that wraps custom elements and calls `connected()` where the browser calls `connectedCallback()`:

```js
import { orderMembers } from "@callbacksystems/eslint-config/order"

export default [
  ...base,
  ...browser,

  ...orderMembers({
    files: [ "src/elements/**/*.js" ],
    groups: [
      { name: "connected-hook", pattern: "^connected$" },
      { name: "disconnected-hook", pattern: "^disconnected$" }
    ],
    after: "disconnected-callback"
  })
]
```

Your groups travel together in the order you list them, and each `name` is what the error message reports. `after` (or `before`) puts that block next to a group that already exists, and without either it goes last. The names to anchor to are in [`member_groups.js`](src/constants/member_groups.js), and reusing one of them is an error rather than a silent override.

## Customizing

Anything after the presets overrides them, so project globals and your own rules go in one trailing block:

```js
import localRules from "#eslint_rules"

export default [
  ...base,
  ...browser,
  ...react,
  {
    languageOptions: { globals: { Stripe: "readonly" } },
    plugins: { local: localRules },
    rules: { "local/no-something": "error" }
  }
]
```

Local rules come in through the `imports` map of your `package.json`, with the wildcard entry covering the imports between rule files:

```json
{
  "imports": {
    "#eslint_rules": "./eslint_rules/index.js",
    "#eslint_rules/*": "./eslint_rules/*.js"
  }
}
```

## Development

```bash
npm install
npm run lint
npm run lint:fix
npm test
npm run test:coverage          # the suite, failing under the coverage thresholds
npm run test:update_snapshots  # regenerate the config snapshots after touching a preset
npm run docs                   # regenerate the rule reference after touching a rule
```

## License

MIT
