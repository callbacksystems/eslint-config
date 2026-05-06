import path from "node:path"
import { Minimatch } from "minimatch"
import { DEFAULT_FILES } from "#constants/files"
import { globsIn } from "#helpers/eslint/globs"
import callbacksystems from "#rules"

const EXPORTS_BLOCK_NAME = "@callbacksystems/restrictions/exports"
const PLUGIN_NAMESPACE = "callbacksystems-boundaries"
const DEFAULT_REASON = "This project boundary forbids it."
const DEFAULT_SYNTAX_REASON = "This project boundary forbids this syntax."
const GLOB_MATCHER_CACHE_LIMIT = 64
const GLOB_MATCHERS = new Map()
const STRING_ARRAY_SCHEMA = { type: "array", items: { type: "string" } }
const ITEM_SCHEMAS = {
  globals: restrictionItemSchemaFor("name"),
  imports: restrictionItemSchemaFor("name", {
    importNames: STRING_ARRAY_SCHEMA,
    message: { type: "string", minLength: 1 }
  }),
  syntax: restrictionItemSchemaFor("selector")
}
const RESTRICTION_PLUGIN = {
  meta: { name: "@callbacksystems/eslint-config/restrictions" },
  rules: {
    globals: boundaryRuleFor("Disallow configured globals within their project boundaries", "globals"),
    imports: boundaryRuleFor("Disallow configured imports within their project boundaries", "imports"),
    syntax: boundaryRuleFor("Disallow configured syntax within its project boundaries", "syntax")
  }
}

export function restrictImports({ files = DEFAULT_FILES, paths }) {
  return restrictionBlockFor("imports", files, paths)
}

export function restrictGlobals({ files = DEFAULT_FILES, globals }) {
  return restrictionBlockFor("globals", files, globals)
}

export function restrictSyntax({ files = DEFAULT_FILES, selectors }) {
  return restrictionBlockFor("syntax", files, selectors)
}

export function restrictExports({ files = DEFAULT_FILES, to }) {
  return [ {
    files,
    name: `${EXPORTS_BLOCK_NAME} in ${globsIn(files)}`,
    plugins: { callbacksystems },
    rules: { "callbacksystems/restrictions/exports": [ "error", { kinds: to } ] }
  } ]
}

function restrictionItemSchemaFor(required, extraProperties = {}) {
  return {
    type: "object",
    required: [ required ],
    properties: {
      [required]: { type: "string" },
      message: { type: "string" },
      allowedIn: STRING_ARRAY_SCHEMA,
      restrictedTo: STRING_ARRAY_SCHEMA,
      ...extraProperties
    },
    additionalProperties: false
  }
}

function boundaryRuleFor(description, kind) {
  return {
    meta: {
      type: "problem",
      docs: { description },
      schema: [ {
        type: "object",
        required: [ "items" ],
        properties: { items: { type: "array", items: ITEM_SCHEMAS[kind], uniqueItems: true } },
        additionalProperties: false
      } ],
      messages: {
        restrictedGlobal: "Unexpected use of `{{name}}`. {{reason}}",
        restrictedImport: "Import from `{{name}}` is restricted. {{reason}}",
        restrictedImportName: "Import `{{importName}}` from `{{name}}` is restricted. {{reason}}",
        restrictedSyntax: "{{reason}}"
      }
    },
    create(context) {
      const applicable = new ApplicableItems(context, context.options[0].items).all
      return applicable.length === 0 ? {} : new BoundaryListeners(context, applicable).listenersFor(kind)
    }
  }
}

class ApplicableItems {
  #context
  #items
  #cachedFilename
  #matchesByGlob = new Map()

  constructor(context, items) {
    this.#context = context
    this.#items = items
  }

  get all() {
    return this.#items.filter((item) => this.#isRequired(item) && !this.#isAllowed(item))
  }

  #isRequired(item) {
    return !item.restrictedTo || this.#matchesAny(item.restrictedTo)
  }

  #matchesAny(globs) {
    return globs.some((glob) => this.#matches(glob))
  }

  #matches(glob) {
    if (!this.#matchesByGlob.has(glob)) {
      this.#matchesByGlob.set(glob, globMatcherFor(glob).match(this.#filename))
    }
    return this.#matchesByGlob.get(glob)
  }

  get #filename() {
    return this.#cachedFilename ??= normalizedRelativePath(this.#context.cwd, this.#context.physicalFilename)
  }

  #isAllowed(item) {
    return item.allowedIn && this.#matchesAny(item.allowedIn)
  }
}

function globMatcherFor(glob) {
  const matcher = GLOB_MATCHERS.get(glob) ?? new Minimatch(glob, { dot: true })
  GLOB_MATCHERS.delete(glob)
  GLOB_MATCHERS.set(glob, matcher)
  if (GLOB_MATCHERS.size > GLOB_MATCHER_CACHE_LIMIT) GLOB_MATCHERS.delete(GLOB_MATCHERS.keys().next().value)
  return GLOB_MATCHERS.get(glob)
}

function normalizedRelativePath(cwd, filename) {
  return path.relative(cwd, filename).split(path.sep).join("/")
}

class BoundaryListeners {
  #context
  #items

  constructor(context, items) {
    this.#context = context
    this.#items = items
  }

  listenersFor(kind) {
    if (kind === "imports") return this.#importListeners
    if (kind === "globals") return this.#globalListeners
    return this.#syntaxListeners
  }

  get #importListeners() {
    const imports = new RestrictedImports(this.#context, this.#items)
    return {
      ExportAllDeclaration: (node) => imports.check(node),
      ExportNamedDeclaration: (node) => imports.check(node),
      ImportDeclaration: (node) => imports.check(node)
    }
  }

  get #globalListeners() {
    return { Program: (node) => new RestrictedGlobals(this.#context, this.#items).check(node) }
  }

  get #syntaxListeners() {
    return Object.fromEntries(
      Map.groupBy(this.#items, (item) => item.selector).entries().map(([ selector, selected ]) => [
        selector,
        (node) => selected.forEach((item) => this.#context.report({
          node,
          messageId: "restrictedSyntax",
          data: { reason: item.message || DEFAULT_SYNTAX_REASON }
        }))
      ])
    )
  }
}

class RestrictedImports {
  #context
  #bySource

  constructor(context, items) {
    this.#context = context
    this.#bySource = Map.groupBy(items, (item) => item.name)
  }

  check(node) {
    const source = node.source?.value
    if (typeof source !== "string") return

    this.#bySource.get(source.trim())?.forEach((item) => new RestrictedImport(this.#context, node, item).report())
  }
}

class RestrictedImport {
  #context
  #node
  #item

  constructor(context, node, item) {
    this.#context = context
    this.#node = node
    this.#item = item
  }

  report() {
    if (this.#item.importNames?.length === 0) return

    if (!this.#item.importNames) {
      this.#reportImport()
    } else if (isNamespaceImport(this.#node)) {
      this.#reportName(this.#node.source, this.#item.importNames.join(", "))
    } else {
      importedNamesIn(this.#node).filter(({ name }) => this.#item.importNames.includes(name))
        .forEach(({ name, node }) => this.#reportName(node, name))
    }
  }

  #reportImport() {
    this.#context.report({
      node: this.#node.source,
      messageId: "restrictedImport",
      data: { name: this.#item.name, reason: this.#reason }
    })
  }

  get #reason() {
    return this.#item.message ?? DEFAULT_REASON
  }

  #reportName(node, importName) {
    this.#context.report({
      node,
      messageId: "restrictedImportName",
      data: { importName, name: this.#item.name, reason: this.#reason }
    })
  }
}

function isNamespaceImport(node) {
  return node.type === "ExportAllDeclaration"
    || node.specifiers.some((specifier) => specifier.type === "ImportNamespaceSpecifier")
}

function importedNamesIn(node) {
  return node.specifiers.map(importedNameOf)
}

function importedNameOf(specifier) {
  if (specifier.type === "ImportDefaultSpecifier") return { name: "default", node: specifier }
  if (specifier.type === "ImportSpecifier") {
    return { name: specifier.imported.name ?? specifier.imported.value, node: specifier }
  }
  return { name: specifier.local.name ?? specifier.local.value, node: specifier }
}

class RestrictedGlobals {
  #context
  #sourceCode
  #byName

  constructor(context, items) {
    this.#context = context
    this.#sourceCode = context.sourceCode
    this.#byName = Map.groupBy(items, (item) => item.name)
  }

  check(program) {
    const scope = this.#sourceCode.getScope(program)
    scope.variables.filter((variable) => variable.defs.length === 0).forEach((variable) => {
      variable.references.forEach((reference) => this.#report(reference))
    })
    scope.through.forEach((reference) => this.#report(reference))
  }

  #report(reference) {
    this.#byName.get(reference.identifier.name)?.forEach((item) => this.#context.report({
      node: reference.identifier,
      messageId: "restrictedGlobal",
      data: { name: item.name, reason: item.message || DEFAULT_REASON }
    }))
  }
}

function restrictionBlockFor(kind, files, items) {
  if (items.length === 0) return []

  return [ {
    files,
    name: `@callbacksystems/restrictions/${kind} in ${globsIn(files)}`,
    plugins: { [PLUGIN_NAMESPACE]: RESTRICTION_PLUGIN },
    rules: { [`${PLUGIN_NAMESPACE}/${kind}`]: [ "error", { items } ] }
  } ]
}
