import { minimatch } from "minimatch"

const DEFAULT_FILES = [ "**/*.{cjs,js,jsx,mjs}" ]

const isGlobSubsetOf = (specific, broader) =>
  specific === broader || minimatch(specific, broader)

const globPrefix = (glob) => {
  const parts = []
  for (const part of glob.split("/")) {
    if (part.includes("*") || part.includes("{")) break

    parts.push(part)
  }
  return parts.join("/")
}

const globsOverlap = (a, b) => {
  const prefixA = globPrefix(a)
  const prefixB = globPrefix(b)
  return prefixA.startsWith(prefixB) || prefixB.startsWith(prefixA)
}

const isRelevantTo = (glob, scopeFiles) =>
  scopeFiles.some((scope) => isGlobSubsetOf(glob, scope) || globsOverlap(glob, scope))

const exemptedAt = (glob, items) => {
  const exempted = new Set()
  for (const item of items) {
    const allowedIn = item.allowedIn ?? []
    if (allowedIn.some((allowedGlob) => isGlobSubsetOf(glob, allowedGlob))) {
      exempted.add(item)
    }
  }
  return exempted
}

const wildcardCount = (glob) => (glob.match(/\*/g) ?? []).length

const sortBySpecificity = (globs) =>
  [ ...globs ].sort((a, b) => wildcardCount(b) - wildcardCount(a) || a.length - b.length)

const collectAllowedGlobs = (items) => {
  const globs = new Set()
  for (const item of items) {
    for (const glob of item.allowedIn ?? []) globs.add(glob)
  }
  return globs
}

const buildOverride = ({ glob, items, ruleName, toRuleConfig }) => {
  const exempted = exemptedAt(glob, items)
  const remaining = items.filter((item) => !exempted.has(item))
  return {
    files: [ glob ],
    rules: remaining.length > 0
      ? { [ruleName]: toRuleConfig(remaining) }
      : { [ruleName]: "off" }
  }
}

const buildBlocksForScope = ({ files, items, ruleName, toRuleConfig }) => {
  if (items.length === 0) return []

  const baseBlock = { files, rules: { [ruleName]: toRuleConfig(items) } }
  const relevantGlobs = [ ...collectAllowedGlobs(items) ].filter((glob) => isRelevantTo(glob, files))
  const overrides = sortBySpecificity(relevantGlobs)
    .map((glob) => buildOverride({ glob, items, ruleName, toRuleConfig }))
  return [ baseBlock, ...overrides ]
}

const groupByRestrictedScope = (items) => {
  const byScope = new Map()
  for (const item of items) {
    const key = JSON.stringify(item.restrictedTo)
    if (!byScope.has(key)) byScope.set(key, { files: item.restrictedTo, items: [] })
    byScope.get(key).items.push(item)
  }
  return [ ...byScope.values() ]
}

const compose = ({ files, ruleName, items, toRuleConfig }) => {
  const globalItems = items.filter((item) => !item.restrictedTo)
  const scopedItems = items.filter((item) => item.restrictedTo)

  const globalBlocks = buildBlocksForScope({ items: globalItems, files, ruleName, toRuleConfig })
  const scopedBlocks = groupByRestrictedScope(scopedItems).flatMap(
    ({ files: scopeFiles, items: scopeItems }) => buildBlocksForScope({
      files: scopeFiles,
      items: [ ...globalItems, ...scopeItems ],
      ruleName,
      toRuleConfig
    })
  )

  return [ ...globalBlocks, ...scopedBlocks ]
}

export const restrictImports = ({ files = DEFAULT_FILES, paths }) =>
  compose({
    files,
    ruleName: "no-restricted-imports",
    items: paths,
    toRuleConfig: (items) => [
      "error",
      { paths: items.map(({ name, message, importNames }) => ({
        name,
        message,
        ...(importNames ? { importNames } : {})
      })) }
    ]
  })

export const restrictGlobals = ({ files = DEFAULT_FILES, globals }) =>
  compose({
    files,
    ruleName: "no-restricted-globals",
    items: globals,
    toRuleConfig: (items) => [ "error", ...items.map(({ name, message }) => ({ name, message })) ]
  })

export const restrictSyntax = ({ files = DEFAULT_FILES, selectors }) =>
  compose({
    files,
    ruleName: "no-restricted-syntax",
    items: selectors,
    toRuleConfig: (items) => [ "error", ...items.map(({ selector, message }) => ({ selector, message })) ]
  })
