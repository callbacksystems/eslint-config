// Relative imports (`../helpers/x`) break when a file moves and hide where a module actually lives. When a bare
// specifier resolves to the same target, prefer it: stable across refactors and aligned with importmap/TS resolution.

import path from "node:path"
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript"
import { onTypes } from "#helpers/ast"
import { reportProblem } from "#helpers/report"

const resolvers = new Map()

export default {
  meta: {
    type: "problem",
    fixable: "code",
    docs: { description: "Disallow relative imports when an equivalent bare import resolves" },
    schema: [],
    messages: { relativeImport: "Relative import \"{{path}}\". Use \"{{suggested}}\" instead." }
  },
  create(context) {
    const resolver = resolverFor(context.cwd)
    return onTypes(
      [ "ImportDeclaration", "ExportAllDeclaration", "ExportNamedDeclaration" ],
      (node) => reportProblem(context, new RelativeImport(node, context.filename, resolver))
    )
  }
}

// Discover baseUrl/paths from ESLint's cwd (the project being linted), not `process.cwd()`, so resolution holds when
// ESLint runs from elsewhere.
function resolverFor(cwd) {
  if (!resolvers.has(cwd)) {
    resolvers.set(cwd, createTypeScriptImportResolver({ project: path.join(cwd, "{ts,js}config.json") }))
  }
  return resolvers.get(cwd)
}

class RelativeImport {
  #node
  #filename
  #resolver
  #cachedSuggestion

  constructor(node, filename, resolver) {
    this.#node = node
    this.#filename = filename
    this.#resolver = resolver
  }

  get problem() {
    return this.#suggested
      ? {
        node: this.#node.source,
        messageId: "relativeImport",
        data: { path: this.#source, suggested: this.#suggested },
        fix: (fixer) => fixer.replaceText(this.#node.source, `"${this.#suggested}"`)
      }
      : null
  }

  get #suggested() {
    return this.#cachedSuggestion ??= this.#isRelativeSource ? this.#bareEquivalent : null
  }

  get #isRelativeSource() {
    return typeof this.#source === "string" && isRelative(this.#source)
  }

  get #source() {
    return this.#node.source?.value
  }

  get #bareEquivalent() {
    const original = this.#resolver.resolve(this.#source, this.#filename)
    return original?.found && original.path
      ? new BareImportSearch(this.#filename, original.path, this.#resolver).candidateFrom(path.dirname(this.#filename))
      : null
  }
}

function isRelative(source) {
  return source.startsWith("./") || source.startsWith("../")
}

class BareImportSearch {
  #currentFile
  #targetFile
  #resolver

  constructor(currentFile, targetFile, resolver) {
    this.#currentFile = currentFile
    this.#targetFile = targetFile
    this.#resolver = resolver
  }

  candidateFrom(directory) {
    return this.#candidateAt(directory) ?? this.#climbAbove(directory)
  }

  #candidateAt(directory) {
    const fromHere = path.relative(directory, this.#targetFile)
    if (fromHere.startsWith("..") || path.isAbsolute(fromHere)) return null

    const candidate = stripExtension(fromHere).split(path.sep).join("/")
    const resolved = this.#resolver.resolve(candidate, this.#currentFile)
    return resolved?.found && resolved.path === this.#targetFile ? candidate : null
  }

  #climbAbove(directory) {
    const parent = path.dirname(directory)
    return parent === directory ? null : this.candidateFrom(parent)
  }
}

function stripExtension(filePath) {
  return filePath.replace(/\.[cm]?[jt]sx?$/u, "")
}
