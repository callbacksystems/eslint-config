const PASCAL_CASE = /^[A-Z]/u
const LEADING_LOWERCASE = /^[a-z]+/u
const IDENTIFIER_NAME = /^[$_\p{ID_Start}][$\u{200C}\u{200D}\p{ID_Continue}]*$/u
// The common prepositions, enough to tell a relating name from a bare one.
const CONNECTORS = new Set([
  "for", "of", "from", "at", "in", "on", "by", "with", "within", "without",
  "into", "onto", "over", "under", "above", "below", "beneath", "behind",
  "beside", "before", "after", "between", "across", "through", "throughout",
  "toward", "towards", "alongside", "during", "via", "to", "per", "until",
  "since", "against", "among", "around", "near", "beyond"
])
const PREDICATE_NAME = /^(is|are|was|were|has|have|had|can|could|should|would|will|did|does|must|needs)[A-Z]/u

export function isPascalCase(name) {
  return typeof name === "string" && PASCAL_CASE.test(name)
}

export function isIdentifierName(name) {
  return typeof name === "string" && IDENTIFIER_NAME.test(name)
}

export function isPredicateName(name) {
  return typeof name === "string" && PREDICATE_NAME.test(name)
}

export function isBooleanName(name) {
  return isPredicateName(name) || isVerbPredicate(name)
}

export function leadingWordOf(name) {
  return LEADING_LOWERCASE.exec(name)?.[0] ?? ""
}

export function leadsWithConnector(name) {
  return CONNECTORS.has(leadingWordOf(name))
}

export function carriesConnector(name) {
  return name.split(/(?=[A-Z])/u).some((word) => CONNECTORS.has(word.toLowerCase()))
}

export function capitalize(name) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function uncapitalize(name) {
  return name.charAt(0).toLowerCase() + name.slice(1)
}

export function screamingSnakeOf(name) {
  return name
    .replaceAll(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .replaceAll(/[^a-zA-Z0-9]+/gu, "_")
    .toUpperCase()
}

function isVerbPredicate(name) {
  if (typeof name !== "string") return false

  const word = leadingWordOf(name)
  // A JS identifier cannot distinguish a plural noun (`prices`) from a third-person verb (`prices`). An open `-s` form
  // makes that ambiguity a missed diagnostic, never a false rename; common uninflected endings stay nouns.
  return word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("sis") && !word.endsWith("tus")
}
