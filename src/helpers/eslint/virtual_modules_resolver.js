// `astro:content` or `cloudflare:workers` exist only as ambient TypeScript declarations. An exact specifier resolves
// when the project declares one of its official providers. `path: null` is how import-x spells a module with no file.

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { findUpStop, findUpSync } from "find-up"

const MANIFEST = "package.json"
const REPOSITORY_MARKER = ".git"
const ASTRO_MODULES = [
  "astro:actions", "astro:assets", "astro:components", "astro:config/client", "astro:config/server",
  "astro:container", "astro:content", "astro:env/client", "astro:env/server", "astro:i18n", "astro:middleware",
  "astro:prefetch", "astro:schema", "astro:static-paths", "astro:transitions", "astro:transitions/client"
]
const ASTRO_PROVIDERS = [ "astro" ]
const MODULE_PROVIDERS = new Map([
  ...ASTRO_MODULES.map((specifier) => [ specifier, ASTRO_PROVIDERS ]),
  [ "astro:db", [ "@astrojs/db" ] ],
  [ "cloudflare:test", [ "@cloudflare/vitest-plugin" ] ],
  [ "cloudflare:workers", [ "@cloudflare/vitest-plugin", "wrangler" ] ],
  [ "virtual:astro:image-styles.css", ASTRO_PROVIDERS ]
])

export class VirtualModulesResolver {
  interfaceVersion = 3
  name = "@callbacksystems/virtual-modules"

  #dependenciesByRoot = new Map()
  #projectRoots = new ProjectRoots()

  resolve(specifier, sourceFile) {
    return this.#serves(specifier, sourceFile) ? { found: true, path: null } : { found: false }
  }

  #serves(specifier, sourceFile) {
    const providers = MODULE_PROVIDERS.get(specifier) ?? []
    return providers.length > 0 && this.#hasProviderNear(providers, sourceFile)
  }

  #hasProviderNear(providers, sourceFile) {
    const dependencies = this.#dependenciesNear(sourceFile)
    return providers.some((name) => dependencies.has(name))
  }

  #dependenciesNear(sourceFile) {
    const root = this.#projectRoots.nearestTo(path.dirname(path.resolve(sourceFile)))
    return root ? this.#dependenciesAt(root) : new Set()
  }

  #dependenciesAt(root) {
    if (!this.#dependenciesByRoot.has(root)) this.#dependenciesByRoot.set(root, declaredIn(path.join(root, MANIFEST)))
    return this.#dependenciesByRoot.get(root)
  }
}

class ProjectRoots {
  #byDirectory = new Map()

  nearestTo(directory) {
    return this.#byDirectory.has(directory)
      ? this.#byDirectory.get(directory)
      : new ProjectRootSearch(directory, this.#byDirectory).value
  }
}

class ProjectRootSearch {
  #directory
  #roots
  #visited = []
  #root = null

  constructor(directory, roots) {
    this.#directory = directory
    this.#roots = roots
  }

  get value() {
    findUpSync((directory) => this.#visit(directory), { cwd: this.#directory })
    this.#visited.forEach((directory) => this.#roots.set(directory, this.#root))
    return this.#root
  }

  #visit(directory) {
    this.#visited.push(directory)
    const root = this.#rootAt(directory)
    if (root !== undefined) this.#root = root
    return root === undefined ? undefined : findUpStop
  }

  #rootAt(directory) {
    if (this.#roots.has(directory)) return this.#roots.get(directory)
    if (existsSync(path.join(directory, MANIFEST))) return directory
    return existsSync(path.join(directory, REPOSITORY_MARKER)) ? null : undefined
  }
}

function declaredIn(manifest) {
  try {
    return dependencyNamesIn(JSON.parse(readFileSync(manifest, "utf8")))
  } catch {
    return new Set()
  }
}

function dependencyNamesIn({ dependencies, devDependencies, optionalDependencies, peerDependencies }) {
  return new Set([
    ...Object.keys(dependencies ?? {}),
    ...Object.keys(devDependencies ?? {}),
    ...Object.keys(optionalDependencies ?? {}),
    ...Object.keys(peerDependencies ?? {})
  ])
}
