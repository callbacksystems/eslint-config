// Relative imports (`../helpers/x`) break when a file moves and hide where a module actually lives. When a bare
// specifier resolves to the same target, prefer it: stable across refactors and aligned with importmap/TS resolution.

import path from "node:path"
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript"
import { onTypes } from "#helpers/syntax/ast"
import { reportProblem } from "#helpers/eslint/report"

const RESOLVER_CACHE_LIMIT = 32
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
    // A processor (Astro client scripts) names virtual files under the component path, so only `physicalFilename`
    // resolves.
    return onTypes(
      [ "ImportDeclaration", "ExportAllDeclaration", "ExportNamedDeclaration" ],
      (node) => reportProblem(context, new RelativeImport(node, context.physicalFilename, resolver))
    )
  }
}

// ESLint's cwd is the project being linted, unlike `process.cwd()` when ESLint runs from elsewhere.
function resolverFor(cwd) {
  return new CachedResolver(cwd, resolvers).value
}

class CachedResolver {
  #cwd
  #cache
  #existing

  constructor(cwd, cache) {
    this.#cwd = cwd
    this.#cache = cache
    this.#existing = cache.get(cwd)
  }

  get value() {
    return this.#existing ? this.#refreshed : this.#created
  }

  get #refreshed() {
    this.#cache.delete(this.#cwd)
    this.#cache.set(this.#cwd, this.#existing)
    return this.#existing
  }

  get #created() {
    this.#cache.set(this.#cwd, this.#newResolver)
    this.#evictOldest()
    return this.#cache.get(this.#cwd)
  }

  get #newResolver() {
    return createTypeScriptImportResolver({ project: path.join(this.#cwd, "{ts,js}config.json") })
  }

  #evictOldest() {
    if (this.#cache.size > RESOLVER_CACHE_LIMIT) this.#cache.delete(this.#cache.keys().next().value)
  }
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
        fix: (fixer) => fixer.replaceText(this.#node.source, JSON.stringify(this.#suggested))
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
    for (let current = directory; ; current = path.dirname(current)) {
      const candidate = this.#candidateAt(current)
      if (candidate) return candidate

      if (path.dirname(current) === current) return null
    }
  }

  #candidateAt(directory) {
    const fromHere = path.relative(directory, this.#targetFile)
    if (fromHere.startsWith("..") || path.isAbsolute(fromHere)) return null

    const candidate = stripExtension(fromHere).split(path.sep).join("/")
    return this.#resolver.resolve(candidate, this.#currentFile).path === this.#targetFile ? candidate : null
  }
}

function stripExtension(filePath) {
  return filePath.replace(/\.[cm]?[jt]sx?$/u, "")
}
