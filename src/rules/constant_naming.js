// A module-level `const` initialized with a fixed primitive is a constant and reads as SCREAMING_SNAKE_CASE
// (`MAX_RETRIES`, `DEFAULT_LOCALE`). What counts as fixed comes from `#helpers/syntax/literals`, here narrowed to
// primitives:
// a number, string, boolean, regex, bigint, `null`, a template that substitutes nothing but other fixed primitives, or
// a signed one. Initializers that compute (`atom("week")`, `parts.join(",")`, `new Map()`), alias a binding, or build
// an object/array stay camelCase: those are derived or configuration, not constants. Local consts inside functions are
// out of scope, and destructuring (`const { a } = x`) is exempt.
//
// Autofix renames only a const local to a module/CommonJS file and not exported: a single-file rename cannot follow
// importers or another classic script sharing the same global lexical environment. The rename also stands down when the
// new name is already taken anywhere a reference could see it, since that would rebind the reference.

import { hasDynamicScope } from "#helpers/scope/dynamic_scope"
import { isFixedPrimitive } from "#helpers/syntax/literals"
import { screamingSnakeOf } from "#helpers/strings/naming"
import { replaceReference } from "#helpers/source/source"
import { reportProblems } from "#helpers/eslint/report"

const SCREAMING_SNAKE_CASE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/u
const AUTO_RENAMEABLE = /^[A-Za-z]\w*$/u
const EXPORT_REFERENCE = new Set([ "ExportSpecifier", "ExportDefaultDeclaration" ])
const EXAMPLE_NAME = "CONSTANT_NAME"
const THROUGH_NAMES_BY_SCOPE = new WeakMap()
const COMMENT_IDENTIFIER = /[A-Za-z]\w*/gu

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
    const { sourceCode } = context
    const canRename = sourceCode.ast.sourceType !== "script" && !hasDynamicScope(sourceCode)
    const comments = new CommentReferences(sourceCode)
    return { "Program:exit": () => reportProblems(context, new ModuleConstants(sourceCode, { canRename, comments })) }
  }
}

// JSDoc and tool comments can contain real identifier references that ESLint's scope manager does not expose. A
// single-file fixer cannot distinguish those from prose safely, so any mentioned name makes the rename report-only.
class CommentReferences {
  #sourceCode
  #cachedNames

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  has(name) {
    return this.#names.has(name)
  }

  get #names() {
    return this.#cachedNames ??= new Set(this.#sourceCode.getAllComments()
      .flatMap((comment) => Array.from(comment.value.matchAll(COMMENT_IDENTIFIER), (match) => match[0])))
  }
}

class ModuleConstants {
  #sourceCode
  #canRename
  #comments
  #cachedConstants

  constructor(sourceCode, { canRename, comments }) {
    this.#sourceCode = sourceCode
    this.#canRename = canRename
    this.#comments = comments
  }

  get problems() {
    const destinations = new RenameDestinations(this.#constants)
    return this.#constants.map((constant) => constant.problemFor(destinations)).filter(Boolean)
  }

  get #constants() {
    return this.#cachedConstants ??= this.#declarators.map((node) => new ModuleConstant(node, this.#sourceCode, {
      canRename: this.#canRename,
      comments: this.#comments
    }))
  }

  get #declarators() {
    return this.#sourceCode.ast.body.flatMap(declaratorsIn)
  }
}

class RenameDestinations {
  #counts

  constructor(constants) {
    this.#counts = new Map()
    constants.map((constant) => constant.renameDestination).filter(Boolean)
      .forEach((name) => this.#counts.set(name, (this.#counts.get(name) ?? 0) + 1))
  }

  isUnique(name) {
    return this.#counts.get(name) === 1
  }
}

class ModuleConstant {
  #node
  #sourceCode
  #canRename
  #comments
  #cache

  constructor(node, sourceCode, { canRename, comments }) {
    this.#node = node
    this.#sourceCode = sourceCode
    this.#canRename = canRename
    this.#comments = comments
  }

  problemFor(destinations) {
    return this.#isOffense ? caseProblem(this.#node.id, this.#expectedName, this.#fixFor(destinations)) : null
  }

  get renameDestination() {
    return this.#isIndividuallyFixable ? this.#expectedName : null
  }

  get #isOffense() {
    return this.#isLiteralConstant && isMiscased(this.#node.id)
  }

  get #isLiteralConstant() {
    return this.#node.id.type === "Identifier" && this.#isTopLevel && isFixedConstantValue(this.#node.init)
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

  get #expectedName() {
    const candidate = normalizedConstantNameOf(this.#node.id.name)
    return SCREAMING_SNAKE_CASE.test(candidate) ? candidate : null
  }

  #fixFor(destinations) {
    return this.renameDestination && destinations.isUnique(this.renameDestination)
      ? (fixer) => this.#rename(fixer)
      : null
  }

  // A `const` always initializes, so renaming every reference covers the declaration too.
  #rename(fixer) {
    return this.#variable.references
      .map((reference) => replaceReference(fixer, reference.identifier, this.#expectedName))
  }

  get #variable() {
    return this.#cache ??= this.#sourceCode.getDeclaredVariables(this.#node)[0]
  }

  get #isIndividuallyFixable() {
    return this.#isOffense && this.#isLocalAndRenameable && this.#canRename
      && !this.#comments.has(this.#node.id.name) && !this.#comments.has(this.#expectedName)
      && this.#isAvailable(this.#expectedName)
  }

  get #isLocalAndRenameable() {
    return !this.#isExported && this.#isAutoRenameable
  }

  get #isExported() {
    return this.#isModuleNamedExport || this.#isReexported
  }

  get #isReexported() {
    return Boolean(this.#variable) && this.#variable.references.some(isExportReference)
  }

  get #isAutoRenameable() {
    return Boolean(this.#expectedName) && AUTO_RENAMEABLE.test(this.#node.id.name)
  }

  // Taken when the module declares it, a global of that name reaches it, or a scope between a reference and the
  // declaration shadows it.
  #isAvailable(newName) {
    return !this.#scope.set.has(newName)
      && !throughNamesIn(this.#scope).has(newName)
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

function caseProblem(nameNode, expectedName, fix) {
  const data = { name: nameNode.name, expected: expectedName ?? EXAMPLE_NAME }
  return { node: nameNode, messageId: "literalConstantCase", data, fix }
}

function isMiscased(nameNode) {
  return !SCREAMING_SNAKE_CASE.test(nameNode.name)
}

function isFixedConstantValue(node) {
  return isFixedPrimitive(node) || (node?.type === "Literal" && Boolean(node.regex))
}

function normalizedConstantNameOf(name) {
  return screamingSnakeOf(name).split("_").filter(Boolean).join("_")
}

function isExportReference(reference) {
  return EXPORT_REFERENCE.has(reference.identifier.parent?.type)
}

function throughNamesIn(scope) {
  if (!THROUGH_NAMES_BY_SCOPE.has(scope)) {
    THROUGH_NAMES_BY_SCOPE.set(scope, new Set(scope.through.map((reference) => reference.identifier.name)))
  }
  return THROUGH_NAMES_BY_SCOPE.get(scope)
}

function declaratorsIn(statement) {
  const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement
  return declaration?.type === "VariableDeclaration" ? declaration.declarations : []
}
