import { minimatch } from "minimatch"
import { DEFAULT_FILES } from "#constants/files"
import { globsIn } from "#helpers/globs"
import callbacksystems from "#rules"

const MAGIC_CHARACTERS = /[*?[\]{}()!+@]/u
const EXPORTS_BLOCK_NAME = "@callbacksystems/restrictions/exports"

export function restrictImports({ files = DEFAULT_FILES, paths }) {
  return new Restriction("no-restricted-imports", importsConfigFor).blocks(files, paths)
}

export function restrictGlobals({ files = DEFAULT_FILES, globals }) {
  return new Restriction("no-restricted-globals", globalsConfigFor).blocks(files, globals)
}

export function restrictSyntax({ files = DEFAULT_FILES, selectors }) {
  return new Restriction("no-restricted-syntax", syntaxConfigFor).blocks(files, selectors)
}

export function restrictExports({ files = DEFAULT_FILES, to }) {
  return [ {
    files,
    name: `${EXPORTS_BLOCK_NAME} in ${globsIn(files)}`,
    plugins: { callbacksystems },
    rules: { "callbacksystems/restrictions/exports": [ "error", { kinds: to } ] }
  } ]
}

class Restriction {
  #toRuleConfig

  constructor(ruleName, toRuleConfig) {
    this.ruleName = ruleName
    this.#toRuleConfig = toRuleConfig
  }

  blocks(files, items) {
    return new RestrictionBlocks(this, files, new ItemSet(items)).all
  }

  configFor(items) {
    return this.#toRuleConfig(items)
  }

  get blockName() {
    return `@callbacksystems/restrictions/${this.ruleName}`
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
    return this.#regions.flatMap((region) => new ScopeBlocks(this.#restriction, region.files, region.items).all)
  }

  // One region per set of scopes a file can fall into, widest first, each restating every item that reaches it since
  // flat config replaces a rule's options instead of merging them.
  get #regions() {
    return [ this.#wholeScope, ...this.#intersections ]
  }

  get #wholeScope() {
    return { files: this.#files, items: this.#all.global }
  }

  get #intersections() {
    return sharedCombinationsOf(this.#all.byRestrictedScope).map((combination) => this.#regionFor(combination))
  }

  #regionFor(combination) {
    return {
      files: intersected(this.#files, combination.map((scope) => scope.files)),
      items: combination.reduce((items, scope) => items.with(scope.items), this.#all.global)
    }
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

  get #baseBlock() {
    return { name: this.#name, files: this.#files, rules: this.#rulesFor(this.#items) }
  }

  // The blocks one helper call yields only tell themselves apart by the globs they cover.
  get #name() {
    return `${this.#restriction.blockName} in ${globsIn(this.#files)}`
  }

  #rulesFor(items) {
    return { [this.#restriction.ruleName]: this.#restriction.configFor(items) }
  }

  get #overrides() {
    return sortBySpecificity(this.#items.allowedGlobs).map((glob) => this.#overrideFor(glob))
  }

  // An `allowedIn` glob lifts a restriction only inside the region it was applied to.
  #overrideFor(glob) {
    const remaining = this.#items.notExemptedAt(glob)
    return {
      name: `${this.#name} allowing ${glob}`,
      files: intersected(this.#files, [ [ glob ] ]),
      rules: remaining.isEmpty ? this.#offRules : this.#rulesFor(remaining)
    }
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
  return glob.split("*").length - 1
}

// Flat config reads a nested array of globs as "matches all of them", so a cartesian product expresses intersection.
function intersected(files, globLists) {
  return globLists.reduce(
    (combinations, globs) => combinations.flatMap((combination) => globs.map((glob) => [ ...combination, glob ])),
    files.map(asCombination)
  )
}

function asCombination(file) {
  return Array.isArray(file) ? [ ...file ] : [ file ]
}

// Fewest scopes first, so the narrowest region is the last one flat config applies.
function sharedCombinationsOf(scopes) {
  return scopes
    .reduce((found, scope) => [ ...found, ...found.map((combination) => [ ...combination, scope ]) ], [ [] ])
    .filter((combination) => combination.length > 0 && sharesFiles(combination))
    .sort((left, right) => left.length - right.length)
}

function sharesFiles(combination) {
  return combination.every((scope, index) =>
    combination.slice(index + 1).every((other) => scopesMeet(scope, other)))
}

// A false yes only costs one redundant block, while a false no would drop a restriction.
function scopesMeet(scope, other) {
  return scope.files.some((glob) =>
    other.files.some((otherGlob) => prefixesMeet(fixedPrefixOf(glob), fixedPrefixOf(otherGlob))))
}

function prefixesMeet(prefix, otherPrefix) {
  return prefix.startsWith(otherPrefix) || otherPrefix.startsWith(prefix)
}

function fixedPrefixOf(glob) {
  const parts = []
  for (const part of glob.split("/")) {
    if (MAGIC_CHARACTERS.test(part)) break

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
    return this.#scopeGroups.values()
      .map((group) => ({ files: group.files, items: new ItemSet(group.items) }))
      .toArray()
  }

  get #scopeGroups() {
    return this.#restricted.reduce((groups, item) => addToScope(groups, item), new Map())
  }

  get #restricted() {
    return this.#items.filter((item) => item.restrictedTo)
  }
}

function isExemptedBy(glob, allowedGlobs) {
  return allowedGlobs.some((allowedGlob) => isCoveredBy(glob, allowedGlob))
}

// A wider `allowedIn` glob covers a nested region when it matches it read as a path (`a/**` over `a/b/**`).
function isCoveredBy(glob, allowedGlob) {
  return glob === allowedGlob || minimatch(glob, allowedGlob)
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
      ...(importNames && { importNames })
    })) }
  ]
}

function globalsConfigFor(items) {
  return [ "error", ...items.entries.map(({ name, message }) => ({ name, message })) ]
}

function syntaxConfigFor(items) {
  return [ "error", ...items.entries.map(({ selector, message }) => ({ selector, message })) ]
}
