// `astro:content` or `cloudflare:workers` exist only as ambient TypeScript declarations, so a scheme resolves when the
// project depends on the tool serving it. `path: null` is how import-x spells a module with no file behind it.

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const MANIFEST = "package.json"
const REPOSITORY_MARKER = ".git"
const SCHEME_PACKAGES = new Map([
  [ "astro", [ "astro" ] ],
  [ "cloudflare", [ "wrangler" ] ],
  [ "virtual", [ "astro", "vite" ] ]
])

export class VirtualModulesResolver {
  interfaceVersion = 3
  name = "@callbacksystems/virtual-modules"

  #dependencies = new Map()

  resolve(specifier, sourceFile) {
    return this.#serves(schemeOf(specifier), sourceFile) ? { found: true, path: null } : { found: false }
  }

  #serves(scheme, sourceFile) {
    const packages = SCHEME_PACKAGES.get(scheme) ?? []
    return packages.some((name) => this.#dependenciesNear(sourceFile).has(name))
  }

  #dependenciesNear(sourceFile) {
    const directory = path.dirname(sourceFile)
    if (!this.#dependencies.has(directory)) this.#dependencies.set(directory, dependenciesFrom(directory))

    return this.#dependencies.get(directory)
  }
}

function schemeOf(specifier) {
  const separator = specifier.indexOf(":")
  return separator === -1 ? null : specifier.slice(0, separator)
}

function dependenciesFrom(directory) {
  const root = projectRootFrom(directory)
  return root ? declaredIn(path.join(root, MANIFEST)) : new Set()
}

// The manifest is checked first, since a single-package repository carries both markers.
function projectRootFrom(directory) {
  if (existsSync(path.join(directory, MANIFEST))) return directory
  if (existsSync(path.join(directory, REPOSITORY_MARKER))) return null

  const parent = path.dirname(directory)
  return parent === directory ? null : projectRootFrom(parent)
}

function declaredIn(manifest) {
  const { dependencies, devDependencies } = JSON.parse(readFileSync(manifest, "utf8"))
  return new Set([ ...Object.keys(dependencies ?? {}), ...Object.keys(devDependencies ?? {}) ])
}
