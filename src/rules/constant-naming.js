// A module-level `const` (or a `static` class field) initialized with a literal
// primitive is a fixed constant and reads as SCREAMING_SNAKE_CASE (`MAX_RETRIES`,
// `DEFAULT_LOCALE`). A literal primitive is a number, string, boolean, regex,
// bigint, `null`, a no-substitution template, or a signed numeric literal.
// Initializers that compute (`atom("week")`, `parts.join(",")`, `new Map()`),
// alias a binding, or build an object/array stay camelCase: those are derived or
// configuration, not constants. Local consts inside functions are out of scope,
// and destructuring (`const { a } = x`) is exempt.
//
// Autofix renames only a const that is local to the module and not exported: a
// single-file rename cannot follow references in other modules, so an exported
// constant (or a `static` field reached as `Class.X`) is report-only.

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

  // A `const` always initializes, so its declaration is the first (write)
  // reference; renaming every reference covers the declaration and all uses, in
  // source order and with no overlap.
  #rename(fixer) {
    const newName = screamingSnakeOf(this.#variable.name)
    return this.#variable.scope.set.has(newName)
      ? null
      : this.#variable.references.map((reference) => fixer.replaceText(reference.identifier, newName))
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
