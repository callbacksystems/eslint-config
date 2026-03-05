# Callback ESLint Config

Callback style guide for JavaScript. Based on the [37signals ESLint config](https://github.com/basecamp/house-style) with additional rules from [SonarJS](https://github.com/SonarSource/SonarJS/blob/master/packages/jsts/src/rules/README.md) and [Perfectionist](https://github.com/azat-io/eslint-plugin-perfectionist).

## Installation

```bash
npm install --save-dev @callbacksystems/eslint-config
```

## Usage

Create an `eslint.config.mjs` file in your project root:

```javascript
import config from "@callbacksystems/eslint-config"

export default config
```

### Adding project-specific globals

```javascript
import config from "@callbacksystems/eslint-config"

export default [
  ...config,
  {
    languageOptions: {
      globals: {
        Stripe: "readonly"
      }
    }
  }
]
```

## License

MIT
