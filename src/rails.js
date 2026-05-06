// Rails-specific overlay. Compose with `/base`, `/browser`, `/stimulus`, and
// `/turbo` from the consumer side. See README for a full example.

export default [
  {
    rules: {
      // Importmap-rails is the source of truth for module resolution; ESLint
      // cannot parse Ruby and would flag every bare import otherwise.
      "import-x/no-unresolved": "off"
    }
  }
]
