import { BindingResolver } from "#helpers/scope/binding_resolver"
import { isClassNode } from "#helpers/syntax/classes"
import { hasDynamicScope } from "#helpers/scope/dynamic_scope"
import { isFunction } from "#helpers/syntax/functions"

const BINDING_DECLARATION_TYPES = new Set([ "ClassDeclaration", "FunctionDeclaration" ])

export function exportedBindingsIn(sourceCode) {
  return new ModuleExports(sourceCode).bindings
}

export function exportedVariablesIn(sourceCode) {
  return new Set(new ModuleExports(sourceCode).bindings.map((binding) => binding.variable).filter(Boolean))
}

class ModuleExports {
  #sourceCode
  #cache
  #resolver
  #hasDynamicScope

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
    this.#resolver = new BindingResolver(sourceCode)
    this.#hasDynamicScope = hasDynamicScope(sourceCode)
  }

  get bindings() {
    return this.#program.body.flatMap((statement) => this.#bindingsOf(statement))
  }

  get #program() {
    return this.#sourceCode.ast
  }

  #bindingsOf(statement) {
    switch (statement.type) {
      case "ExportAllDeclaration": return [ reexportOf(statement) ]
      case "ExportDefaultDeclaration": return [ this.#defaultBindingOf(statement) ]
      case "ExportNamedDeclaration": return this.#namedBindingsOf(statement)
      default: return []
    }
  }

  #defaultBindingOf(statement) {
    const { declaration } = statement
    const localName = localNameOfDefault(declaration)
    return {
      name: localName,
      kind: this.#kindOf(declaration),
      node: statement,
      variable: this.#variableNamed(localName),
      localName
    }
  }

  #kindOf(node) {
    const value = new ExportValue(node)
    return value.identifier ? this.#kindOfBinding(value.identifier) : value.kind
  }

  #kindOfBinding(identifier) {
    return new ExportKind(identifier, this.#resolver, this.#hasDynamicScope).value
  }

  #variableNamed(name) {
    return name ? this.#moduleScope.set.get(name) ?? null : null
  }

  // The innermost scope the program opens, since a module body sits inside the global scope.
  get #moduleScope() {
    return this.#cache ??= this.#sourceCode.scopeManager.acquire(this.#program, true)
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
        : [ this.#declarationBindingOf(declaration) ]
    } else {
      return null
    }
  }

  #variableBindingsOf(declaration) {
    return declaration.declarations.flatMap((declarator) => this.#declaratorBindingsOf(declarator))
  }

  #declaratorBindingsOf(declarator) {
    return this.#sourceCode.getDeclaredVariables(declarator)
      .map((variable) => ({
        name: variable.name,
        kind: this.#kindOfBinding(variable.identifiers[0]),
        node: declarator,
        localName: variable.name,
        variable
      }))
  }

  #declarationBindingOf(declaration) {
    const localName = bindingNameOf(declaration.id)
    return {
      name: localName,
      kind: declaration.id ? this.#kindOfBinding(declaration.id) : new ExportValue(declaration).kind,
      node: declaration,
      variable: this.#variableNamed(localName),
      localName
    }
  }

  #specifierBindingsOf(statement) {
    return statement.specifiers.map((specifier) => this.#specifierBindingOf(specifier))
  }

  #specifierBindingOf(specifier) {
    const localName = bindingNameOf(specifier.local)
    return {
      name: bindingNameOf(specifier.exported),
      kind: this.#kindOfBinding(specifier.local),
      node: specifier,
      variable: this.#variableNamed(localName),
      localName
    }
  }
}

function reexportOf(declaration) {
  return {
    name: bindingNameOf(declaration.exported),
    localName: null,
    kind: "reexport",
    variable: null,
    node: declaration
  }
}

// An exported name is an identifier, or a string literal in `export { a as "b" }`.
function bindingNameOf(bindingNode) {
  if (bindingNode) {
    return bindingNode.type === "Literal" ? bindingNode.value : bindingNode.name ?? null
  } else {
    return null
  }
}

function localNameOfDefault(declaration) {
  return BINDING_DECLARATION_TYPES.has(declaration.type)
    ? bindingNameOf(declaration.id)
    : identifierNameOf(declaration)
}

function identifierNameOf(value) {
  return value.type === "Identifier" ? value.name : null
}

class ExportValue {
  #node

  constructor(node) {
    this.#node = node
  }

  get identifier() {
    if (this.#node.type === "Identifier") return this.#node
    return BINDING_DECLARATION_TYPES.has(this.#node.type) ? this.#node.id : null
  }

  get kind() {
    if (isClassNode(this.#node)) return "class"
    return isFunction(this.#node) ? "function" : "constant"
  }
}

class ExportKind {
  #identifier
  #resolver
  #hasDynamicScope

  constructor(identifier, resolver, hasDynamicScope) {
    this.#identifier = identifier
    this.#resolver = resolver
    this.#hasDynamicScope = hasDynamicScope
  }

  get value() {
    if (this.#isReexport) return "reexport"
    if (this.#isDynamicallyMutable) return "constant"
    if (this.#resolver.classFor(this.#identifier)) return "class"
    if (this.#resolver.functionFor(this.#identifier)) return "function"

    return "constant"
  }

  get #isReexport() {
    return this.#resolver.variableFor(this.#identifier)?.defs[0]?.type === "ImportBinding"
  }

  get #isDynamicallyMutable() {
    return this.#hasDynamicScope && !this.#resolver.isImmutableValue(this.#identifier)
  }
}

function reexportedBindingsOf(statement) {
  return statement.source ? statement.specifiers.map(reexportOf) : null
}
