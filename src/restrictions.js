import { minimatch } from "minimatch"

const DEFAULT_FILES = [ "**/*.{cjs,js,jsx,mjs}" ]

export function restrictImports({ files = DEFAULT_FILES, paths }) {
  return new Restriction("no-restricted-imports", importsConfigFor).blocks(files, paths)
}

export function restrictGlobals({ files = DEFAULT_FILES, globals }) {
  return new Restriction("no-restricted-globals", globalsConfigFor).blocks(files, globals)
}

export function restrictSyntax({ files = DEFAULT_FILES, selectors }) {
  return new Restriction("no-restricted-syntax", syntaxConfigFor).blocks(files, selectors)
}

class Restriction {
  #ruleName
  #toRuleConfig

  constructor(ruleName, toRuleConfig) {
    this.#ruleName = ruleName
    this.#toRuleConfig = toRuleConfig
  }

  blocks(files, items) {
    return new RestrictionBlocks(this, files, new ItemSet(items)).all
  }

  configFor(items) {
    return this.#toRuleConfig(items)
  }

  get ruleName() {
    return this.#ruleName
  }
}

class RestrictionBlocks {
  #restriction
  #files
  #all

  constructor(restriction, files, all) {
    this.#restriction = restriction
    this.#files = files
    this.#all = all
  }

  get all() {
    return [ ...this.#globalBlocks, ...this.#scopedBlocks ]
  }

  #scopeBlocks(files, items) {
    return new ScopeBlocks(this.#restriction, files, items).all
  }

  get #globalBlocks() {
    return this.#scopeBlocks(this.#files, this.#all.global)
  }

  get #scopedBlocks() {
    return this.#all.byRestrictedScope.flatMap((scope) =>
      this.#scopeBlocks(scope.files, this.#all.global.with(scope.items)))
  }
}

class ScopeBlocks {
  #restriction
  #files
  #items

  constructor(restriction, files, items) {
    this.#restriction = restriction
    this.#files = files
    this.#items = items
  }

  get all() {
    return this.#items.isEmpty ? [] : [ this.#baseBlock, ...this.#overrides ]
  }

  #rulesFor(items) {
    return { [this.#restriction.ruleName]: this.#restriction.configFor(items) }
  }

  #overrideFor(glob) {
    const remaining = this.#items.notExemptedAt(glob)
    return { files: [ glob ], rules: remaining.isEmpty ? this.#offRules : this.#rulesFor(remaining) }
  }

  get #baseBlock() {
    return { files: this.#files, rules: this.#rulesFor(this.#items) }
  }

  get #overrides() {
    return sortBySpecificity(this.#relevantGlobs).map((glob) => this.#overrideFor(glob))
  }

  get #relevantGlobs() {
    return this.#items.allowedGlobs.filter((glob) => new GlobRelevance(glob, this.#files).isRelevant)
  }

  get #offRules() {
    return { [this.#restriction.ruleName]: "off" }
  }
}

function sortBySpecificity(globs) {
  return [ ...globs ].sort(bySpecificity)
}

function bySpecificity(first, second) {
  return wildcardCountIn(second) - wildcardCountIn(first) || first.length - second.length
}

function wildcardCountIn(glob) {
  return (glob.match(/\*/g) ?? []).length
}

class GlobRelevance {
  #glob
  #scopeFiles

  constructor(glob, scopeFiles) {
    this.#glob = glob
    this.#scopeFiles = scopeFiles
  }

  get isRelevant() {
    return this.#scopeFiles.some((scope) => this.#touches(scope))
  }

  #touches(scope) {
    const match = new GlobMatch({ specific: this.#glob, broader: scope })
    return match.isSubset || match.overlaps
  }
}

class GlobMatch {
  #specific
  #broader

  constructor({ specific, broader }) {
    this.#specific = specific
    this.#broader = broader
  }

  get isSubset() {
    return this.#specific === this.#broader || minimatch(this.#specific, this.#broader)
  }

  get overlaps() {
    const specificPrefix = prefixOf(this.#specific)
    const broaderPrefix = prefixOf(this.#broader)
    return specificPrefix.startsWith(broaderPrefix) || broaderPrefix.startsWith(specificPrefix)
  }
}

function prefixOf(glob) {
  const parts = []
  for (const part of glob.split("/")) {
    if (part.includes("*") || part.includes("{")) break

    parts.push(part)
  }
  return parts.join("/")
}

class ItemSet {
  #items

  constructor(items) {
    this.#items = items
  }

  with(others) {
    return new ItemSet([ ...this.#items, ...others.entries ])
  }

  notExemptedAt(glob) {
    return new ItemSet(this.#items.filter((item) => !isExemptedBy(glob, item.allowedIn ?? [])))
  }

  get isEmpty() {
    return this.#items.length === 0
  }

  get global() {
    return new ItemSet(this.#items.filter((item) => !item.restrictedTo))
  }

  get allowedGlobs() {
    return [ ...new Set(this.#items.flatMap((item) => item.allowedIn ?? [])) ]
  }

  get entries() {
    return this.#items
  }

  get byRestrictedScope() {
    return [ ...this.#scopeGroups.values() ].map((group) => ({ files: group.files, items: new ItemSet(group.items) }))
  }

  get #scopeGroups() {
    return this.#restricted.reduce((groups, item) => addToScope(groups, item), new Map())
  }

  get #restricted() {
    return this.#items.filter((item) => item.restrictedTo)
  }
}

function isExemptedBy(glob, allowedGlobs) {
  return allowedGlobs.some((allowedGlob) => new GlobMatch({ specific: glob, broader: allowedGlob }).isSubset)
}

function addToScope(groups, item) {
  const key = JSON.stringify(item.restrictedTo)
  if (!groups.has(key)) groups.set(key, { files: item.restrictedTo, items: [] })
  groups.get(key).items.push(item)
  return groups
}

function importsConfigFor(items) {
  return [
    "error",
    { paths: items.entries.map(({ name, message, importNames }) => ({
      name,
      message,
      ...(importNames ? { importNames } : {})
    })) }
  ]
}

function globalsConfigFor(items) {
  return [ "error", ...items.entries.map(({ name, message }) => ({ name, message })) ]
}

function syntaxConfigFor(items) {
  return [ "error", ...items.entries.map(({ selector, message }) => ({ selector, message })) ]
}
