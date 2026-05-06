// Privacy via `#` (JS hard-private) or `private` (TS).
// `_` prefix is legacy convention and silently public.

import { onTypes } from "#helpers/ast"

export default {
  meta: {
    type: "problem",
    docs: { description: "Disallow `_`-prefixed class members; use `#` (JS) or `private` (TS)" },
    schema: [],
    messages: { noUnderscorePrivate: "Use `#{{name}}` or `private {{name}}` instead of `_{{name}}` for class privacy." }
  },
  create(context) {
    function report(node) {
      if (isUnderscored(node)) {
        context.report({
          node: node.key,
          messageId: "noUnderscorePrivate",
          data: { name: node.key.name.replace(/^_+/u, "") }
        })
      }
    }

    return onTypes([ "PropertyDefinition", "MethodDefinition" ], report)
  }
}

function isUnderscored(node) {
  return node.key.type === "Identifier" && node.key.name.startsWith("_")
}
