// `@/foo` is an alias to the project root used by Vite/Next/Astro/Expo.
// `@scope/package` is a scoped npm package and is allowed.
const isAliasImport = (source) => /^@\//u.test(source)

export default {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description: "Disallow `@/` alias imports; prefer baseUrl-style bare imports"
    },
    schema: [],
    messages: {
      aliasImport: "Alias import \"{{path}}\". Configure jsconfig/tsconfig `baseUrl` and import as \"{{suggested}}\"."
    }
  },
  create(context) {
    const check = (node) => {
      const source = node.source?.value
      if (typeof source !== "string" || !isAliasImport(source)) return

      const suggested = source.slice(2)

      context.report({
        node: node.source,
        messageId: "aliasImport",
        data: { path: source, suggested },
        fix: (fixer) => fixer.replaceText(node.source, `"${suggested}"`)
      })
    }

    return {
      ImportDeclaration: check,
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check
    }
  }
}
