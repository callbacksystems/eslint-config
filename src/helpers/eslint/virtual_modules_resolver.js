// `astro:content` or `cloudflare:workers` exist only as ambient TypeScript declarations. An exact specifier resolves
// when the project declares one of its official providers. `path: null` is how import-x spells a module with no file.

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

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
  #current
  #roots
  #visited = []
  #root

  constructor(directory, roots) {
    this.#current = directory
    this.#roots = roots
  }

  get value() {
    while (this.#root === undefined) this.#visitCurrent()
    this.#visited.forEach((directory) => this.#roots.set(directory, this.#root))
    return this.#root
  }

  #visitCurrent() {
    this.#visited.push(this.#current)
    if (this.#roots.has(this.#current)) this.#useKnownRoot()
    else if (existsSync(path.join(this.#current, MANIFEST))) this.#useCurrentRoot()
    else if (existsSync(path.join(this.#current, REPOSITORY_MARKER))) this.#stopAtRepository()
    else this.#ascend()
  }

  #useKnownRoot() {
    this.#root = this.#roots.get(this.#current)
  }

  #useCurrentRoot() {
    this.#root = this.#current
  }

  #stopAtRepository() {
    this.#root = null
  }

  #ascend() {
    const parent = path.dirname(this.#current)
    if (parent === this.#current) this.#root = null
    else this.#current = parent
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
