// A module-level `const` (or a `static` class field) initialized with a literal primitive is a fixed constant and reads
// as SCREAMING_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_LOCALE`). A literal primitive is a number, string, boolean, regex,
// bigint, `null`, a no-substitution template, or a signed numeric literal. Initializers that compute (`atom("week")`,
// `parts.join(",")`, `new Map()`), alias a binding, or build an object/array stay camelCase: those are derived or
// configuration, not constants. Local consts inside functions are out of scope, and destructuring (`const { a } = x`)
// is exempt.
//
// Autofix renames only a const that is local to the module and not exported: a single-file rename cannot follow
// references in other modules, so an exported constant (or a `static` field reached as `Class.X`) is report-only. The
// rename also stands down when the new name is already taken anywhere a reference could see it, since renaming into an
// occupied name rebinds the reference.

import { reportProblem } from "#helpers/report"

const SCREAMING_SNAKE_CASE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/u
const SIGN_OPERATORS = new Set([ "-", "+", "~" ])
const NAMED_KEY = new Set([ "Identifier", "PrivateIdentifier" ])
const EXPORT_REFERENCE = new Set([ "ExportSpecifier", "ExportDefaultDeclaration" ])

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Require SCREAMING_SNAKE_CASE for module-level and static literal constants" },
    schema: [],
    messages: {
      literalConstantCase: "`{{name}}` is a literal constant; name it SCREAMING_SNAKE_CASE (e.g. `{{expected}}`)."
    }
  },
  create(context) {
    return {
      VariableDeclarator: (node) => reportProblem(context, new ModuleConstant(node, context.sourceCode)),
      PropertyDefinition: (node) => reportProblem(context, new StaticField(node))
    }
  }
}

class ModuleConstant {
  #node
  #sourceCode
  #cache

  constructor(node, sourceCode) {
    this.#node = node
    this.#sourceCode = sourceCode
  }

  get problem() {
    return this.#isOffense ? caseProblem(this.#node.id, this.#fix) : null
  }

  // A `const` always initializes, so renaming every reference covers the declaration too.
  #rename(fixer) {
    const newName = screamingSnakeOf(this.#variable.name)
    return this.#isAvailable(newName)
      ? this.#variable.references.map((reference) => fixer.replaceText(reference.identifier, newName))
      : null
  }

  // Not free when the module declares it, when a global of that name reaches this module, or when a scope between a
  // reference and the declaration declares it: that reference would silently resolve to the inner binding.
  #isAvailable(newName) {
    return !this.#scope.set.has(newName)
      && !this.#scope.through.some((reference) => reference.identifier.name === newName)
      && this.#variable.references.every((reference) => !this.#isShadowedAt(reference, newName))
  }

  #isShadowedAt(reference, newName) {
    for (let scope = reference.from; scope && scope !== this.#scope; scope = scope.upper) {
      if (scope.set.has(newName)) return true
    }
    return false
  }

  get #isOffense() {
    return this.#isLiteralConstant && isMiscased(this.#node.id)
  }

  get #isLiteralConstant() {
    return this.#node.id.type === "Identifier" && this.#isTopLevel && isLiteralPrimitive(this.#node.init)
  }

  get #isTopLevel() {
    return this.#declaration.kind === "const" && this.#isInModuleBody
  }

  get #declaration() {
    return this.#node.parent
  }

  get #isInModuleBody() {
    return this.#container.type === "Program" || this.#isModuleNamedExport
  }

  get #container() {
    return this.#declaration.parent
  }

  get #isModuleNamedExport() {
    return this.#container.type === "ExportNamedDeclaration" && this.#container.parent.type === "Program"
  }

  get #fix() {
    return this.#isExported ? null : (fixer) => this.#rename(fixer)
  }

  get #isExported() {
    return this.#isModuleNamedExport || this.#isReexported
  }

  get #isReexported() {
    return Boolean(this.#variable) && this.#variable.references.some(isExportReference)
  }

  get #variable() {
    return this.#cache ??= this.#sourceCode.getDeclaredVariables(this.#node)[0]
  }

  get #scope() {
    return this.#variable.scope
  }
}

function caseProblem(nameNode, fix) {
  const data = { name: nameNode.name, expected: screamingSnakeOf(nameNode.name) }
  return { node: nameNode, messageId: "literalConstantCase", data, fix }
}

function screamingSnakeOf(name) {
  return name
    .replaceAll(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .replaceAll(/[^a-zA-Z0-9]+/gu, "_")
    .toUpperCase()
}

function isMiscased(nameNode) {
  return !SCREAMING_SNAKE_CASE.test(nameNode.name)
}

function isLiteralPrimitive(node) {
  if (!node) return false
  if (node.type === "Literal") return true
  if (node.type === "TemplateLiteral") return node.expressions.length === 0

  return node.type === "UnaryExpression" && isSignedLiteral(node)
}

function isSignedLiteral(node) {
  return SIGN_OPERATORS.has(node.operator) && isLiteralPrimitive(node.argument)
}

function isExportReference(reference) {
  return EXPORT_REFERENCE.has(reference.identifier.parent?.type)
}

class StaticField {
  #node

  constructor(node) {
    this.#node = node
  }

  get problem() {
    return this.#isOffense ? caseProblem(this.#node.key, null) : null
  }

  get #isOffense() {
    return this.#isLiteralField && isMiscased(this.#node.key)
  }

  get #isLiteralField() {
    return this.#node.static && this.#isNamedKey && isLiteralPrimitive(this.#node.value)
  }

  get #isNamedKey() {
    return !this.#node.computed && NAMED_KEY.has(this.#node.key.type)
  }
}
