// A module-level `const` initialized with a fixed primitive is a constant and reads as SCREAMING_SNAKE_CASE
// (`MAX_RETRIES`, `DEFAULT_LOCALE`). What counts as fixed comes from `#helpers/literals`, here narrowed to primitives:
// a number, string, boolean, regex, bigint, `null`, a template that substitutes nothing but other fixed primitives, or
// a signed one. Initializers that compute (`atom("week")`, `parts.join(",")`, `new Map()`), alias a binding, or build
// an object/array stay camelCase: those are derived or configuration, not constants. Local consts inside functions are
// out of scope, and destructuring (`const { a } = x`) is exempt.
//
// Autofix renames only a const that is local to the module and not exported: a single-file rename cannot follow
// references in other modules, so an exported constant is report-only. The rename also stands down when the new name is
// already taken anywhere a reference could see it, since renaming into an occupied name rebinds the reference.

import { isFixedPrimitive } from "#helpers/literals"
import { screamingSnakeOf } from "#helpers/naming"
import { replaceReference } from "#helpers/source"
import { reportProblem } from "#helpers/report"

const SCREAMING_SNAKE_CASE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/u
const EXPORT_REFERENCE = new Set([ "ExportSpecifier", "ExportDefaultDeclaration" ])

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Require SCREAMING_SNAKE_CASE for module-level literal constants" },
    schema: [],
    messages: {
      literalConstantCase: "`{{name}}` is a literal constant; name it SCREAMING_SNAKE_CASE (e.g. `{{expected}}`)."
    }
  },
  create(context) {
    return { VariableDeclarator: (node) => reportProblem(context, new ModuleConstant(node, context.sourceCode)) }
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

  get #isOffense() {
    return this.#isLiteralConstant && isMiscased(this.#node.id)
  }

  get #isLiteralConstant() {
    return this.#node.id.type === "Identifier" && this.#isTopLevel && isFixedPrimitive(this.#node.init)
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

  // A `const` always initializes, so renaming every reference covers the declaration too.
  #rename(fixer) {
    const newName = screamingSnakeOf(this.#variable.name)
    return this.#isAvailable(newName)
      ? this.#variable.references.map((reference) => replaceReference(fixer, reference.identifier, newName))
      : null
  }

  // Taken when the module declares it, a global of that name reaches it, or a scope between a reference and the
  // declaration shadows it.
  #isAvailable(newName) {
    return !this.#scope.set.has(newName)
      && this.#scope.through.every((reference) => reference.identifier.name !== newName)
      && this.#variable.references.every((reference) => !this.#isShadowedAt(reference, newName))
  }

  get #scope() {
    return this.#variable.scope
  }

  #isShadowedAt(reference, newName) {
    for (let scope = reference.from; scope && scope !== this.#scope; scope = scope.upper) {
      if (scope.set.has(newName)) return true
    }
    return false
  }
}

function caseProblem(nameNode, fix) {
  const data = { name: nameNode.name, expected: screamingSnakeOf(nameNode.name) }
  return { node: nameNode, messageId: "literalConstantCase", data, fix }
}

function isMiscased(nameNode) {
  return !SCREAMING_SNAKE_CASE.test(nameNode.name)
}

function isExportReference(reference) {
  return EXPORT_REFERENCE.has(reference.identifier.parent?.type)
}
