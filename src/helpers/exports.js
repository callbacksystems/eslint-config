// A module's public surface, as one `{ name, kind, node }` entry per exported binding, where the kind is `class`,
// `function`, `constant` or `reexport`. Type-only exports are left out: they carry no runtime value.

const CLASS_TYPES = new Set([ "ClassDeclaration", "ClassExpression" ])
const FUNCTION_TYPES = new Set([ "FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression" ])
const KIND_BY_DEFINITION = { ClassName: "class", FunctionName: "function", ImportBinding: "reexport" }

export function exportedBindingsIn(sourceCode) {
  return new ModuleExports(sourceCode).bindings
}

class ModuleExports {
  #sourceCode
  #cache

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  get bindings() {
    return this.#program.body.flatMap((statement) => this.#bindingsOf(statement))
  }

  get #program() {
    return this.#sourceCode.ast
  }

  #bindingsOf(statement) {
    if (isTypeOnly(statement)) return []

    switch (statement.type) {
      case "ExportAllDeclaration": return [ reexportOf(statement) ]
      case "ExportDefaultDeclaration": return [ this.#defaultBindingOf(statement) ]
      case "ExportNamedDeclaration": return this.#namedBindingsOf(statement)
      default: return []
    }
  }

  #defaultBindingOf(statement) {
    const { declaration } = statement
    return { name: bindingNameOf(declaration.id ?? declaration), kind: this.#kindOf(declaration), node: statement }
  }

  #kindOf(node) {
    return node.type === "Identifier" ? this.#kindOfBinding(node.name) : kindOfValue(node)
  }

  #kindOfBinding(name) {
    const definition = this.#moduleScope.set.get(name)?.defs[0]
    return definition ? KIND_BY_DEFINITION[definition.type] ?? kindOfValue(definition.node.init) : "constant"
  }

  // The innermost scope the program opens, since a module body sits inside the global scope.
  get #moduleScope() {
    return this.#cache ??= this.#sourceCode.scopeManager.acquire(this.#program, true) ?? this.#globalScope
  }

  get #globalScope() {
    return this.#sourceCode.scopeManager.globalScope
  }

  #namedBindingsOf(statement) {
    return reexportedBindingsOf(statement)
      ?? this.#declaredBindingsOf(statement.declaration)
      ?? this.#specifierBindingsOf(statement)
  }

  #declaredBindingsOf(declaration) {
    if (declaration) {
      return declaration.type === "VariableDeclaration"
        ? this.#variableBindingsOf(declaration)
        : [ declarationBindingOf(declaration) ]
    } else {
      return null
    }
  }

  #variableBindingsOf(declaration) {
    return declaration.declarations.flatMap((declarator) => this.#declaratorBindingsOf(declarator))
  }

  #declaratorBindingsOf(declarator) {
    return this.#sourceCode.getDeclaredVariables(declarator)
      .map((variable) => ({ name: variable.name, kind: kindOfValue(declarator.init), node: declarator }))
  }

  #specifierBindingsOf(statement) {
    return statement.specifiers.filter(isValueSpecifier).map((specifier) => this.#specifierBindingOf(specifier))
  }

  #specifierBindingOf(specifier) {
    return { name: bindingNameOf(specifier.exported), kind: this.#kindOfBinding(specifier.local.name), node: specifier }
  }
}

function isTypeOnly(statement) {
  return statement.exportKind === "type"
}

function reexportOf(node) {
  return { name: bindingNameOf(node.exported), kind: "reexport", node }
}

// An exported name is an identifier, or a string literal in `export { a as "b" }`.
function bindingNameOf(node) {
  if (node) {
    return node.type === "Literal" ? node.value : node.name ?? null
  } else {
    return null
  }
}

function kindOfValue(node) {
  if (CLASS_TYPES.has(node?.type)) return "class"

  return FUNCTION_TYPES.has(node?.type) ? "function" : "constant"
}

function reexportedBindingsOf(statement) {
  return statement.source ? statement.specifiers.map(reexportOf) : null
}

function declarationBindingOf(declaration) {
  return { name: bindingNameOf(declaration.id), kind: kindOfValue(declaration), node: declaration }
}

function isValueSpecifier(specifier) {
  return !isTypeOnly(specifier)
}
