// Module-scope `let` is global mutable state: race conditions, untestable, hidden coupling. Use a class instance,
// factory function, or `const` with internal mutation (e.g. `Map`/`Set`).

export default {
  meta: {
    type: "problem",
    docs: { description: "Disallow `let`/`var` declarations at module scope" },
    schema: [],
    messages: {
      mutableModuleScope: "Top-level `{{kind}}` is global mutable state. Encapsulate in a class or use `const`."
    }
  },
  create(context) {
    return isComponentFile(context.physicalFilename)
      ? {}
      : { "Program:exit": (node) => reportMutableBindings(context, node) }
  }
}

function isComponentFile(filename) {
  return /\.(?:astro|svelte)$/u.test(filename)
}

function reportMutableBindings(context, program) {
  new Set(moduleScopeIn(context.sourceCode, program).variables.flatMap((variable) => variable.defs)
    .filter((definition) => definition.type === "Variable" && definition.parent.kind !== "const")
    .map((definition) => definition.node)).forEach((declarator) => context.report({
    node: declarator,
    messageId: "mutableModuleScope",
    data: { kind: declarator.parent.kind }
  }))
}

function moduleScopeIn(sourceCode, program) {
  return sourceCode.scopeManager.scopes.find((scope) => scope.type === "module") ?? sourceCode.getScope(program)
}
