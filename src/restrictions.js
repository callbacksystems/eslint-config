import { minimatch } from "minimatch"

const DEFAULT_FILES = [ "**/*.{cjs,js,jsx,mjs}" ]
const MAGIC_CHARACTERS = /[*?[\]{}()!+@]/u

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
    return this.#regions.flatMap((region) => new ScopeBlocks(this.#restriction, region.files, region.items).all)
  }

  #regionFor(combination) {
    return {
      files: intersected(this.#files, combination.map((scope) => scope.files)),
      items: combination.reduce((items, scope) => items.with(scope.items), this.#all.global)
    }
  }

  // A region per set of scopes a file can fall into at once, widest first. Each one restates every item that reaches
  // it: flat config replaces a rule's options instead of merging them, so a narrower block listing only its own items
  // would silently drop what a wider block had already restricted.
  get #regions() {
    return [ this.#wholeScope, ...this.#intersections ]
  }

  get #wholeScope() {
    return { files: this.#files, items: this.#all.global }
  }

  get #intersections() {
    return sharedCombinationsOf(this.#all.byRestrictedScope).map((combination) => this.#regionFor(combination))
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

  // Narrowed to this region: an `allowedIn` glob lifts a restriction only where that restriction was applied, never
  // across the rest of the project.
  #overrideFor(glob) {
    const remaining = this.#items.notExemptedAt(glob)
    return {
      files: intersected(this.#files, [ [ glob ] ]),
      rules: remaining.isEmpty ? this.#offRules : this.#rulesFor(remaining)
    }
  }

  get #baseBlock() {
    return { files: this.#files, rules: this.#rulesFor(this.#items) }
  }

  get #overrides() {
    return sortBySpecificity(this.#items.allowedGlobs).map((glob) => this.#overrideFor(glob))
  }

  get #offRules() {
    return { [this.#restriction.ruleName]: "off" }
  }
}

// Flat config reads a nested array of globs as "matches all of them", so the cartesian product of the scope with each
// group expresses their intersection.
function intersected(files, globLists) {
  return globLists.reduce(
    (combinations, globs) => combinations.flatMap((combination) => globs.map((glob) => [ ...combination, glob ])),
    files.map(asCombination)
  )
}

function asCombination(file) {
  return Array.isArray(file) ? [ ...file ] : [ file ]
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

// Each combination of `restrictedTo` scopes that could share a file, fewest scopes first so the narrowest region is the
// last one flat config applies. A pair whose globs cannot both match is dropped, so scopes that never meet cost
// nothing.
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

// Conservative on purpose: two scopes count as meeting unless their globs' fixed prefixes rule it out. A false yes
// costs one redundant block; a false no would drop a restriction, which is the failure this whole shape exists to
// prevent.
function scopesMeet(scope, other) {
  return scope.files.some((glob) => other.files.some((otherGlob) => prefixesMeet(prefixOf(glob), prefixOf(otherGlob))))
}

function prefixesMeet(prefix, otherPrefix) {
  return prefix.startsWith(otherPrefix) || otherPrefix.startsWith(prefix)
}

// The leading path segments a glob pins down, up to its first magic character.
function prefixOf(glob) {
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
  return allowedGlobs.some((allowedGlob) => isCoveredBy(glob, allowedGlob))
}

// Whether an `allowedIn` glob covers the region being exempted: the same pattern, or a wider one that matches it read
// as a path (how a nested `a/b/**` relates to `a/**`).
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
