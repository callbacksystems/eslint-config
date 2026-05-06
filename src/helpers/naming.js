const PASCAL_CASE = /^[A-Z]/u
const LEADING_LOWERCASE = /^[a-z]+/u
// Prepositions that relate a returned value to a method's arguments
// (`userFor(id)`, `nodeAt(i)`, `scopeFrom(node)`). An open class; this is the
// common core, enough to tell a relating name from a bare one.
const CONNECTORS = new Set([
  "for", "of", "from", "at", "in", "on", "by", "with", "within", "without",
  "into", "onto", "over", "under", "above", "below", "beneath", "behind",
  "beside", "before", "after", "between", "across", "through", "throughout",
  "toward", "towards", "alongside", "during", "via", "to", "per", "until",
  "since", "against", "among", "around", "near", "beyond"
])
const PREDICATE_NAME = /^(is|are|was|were|has|have|had|can|could|should|would|will|did|does|must|needs)[A-Z]/u
// A third-person-singular verb predicate: the first camelCase word ends in "s"
// (`forwards`, `delegates`, `includes`, `matches`). The JS convention pairs these
// action/relation predicates with the `is`/`has` prefixes used for state.
const VERB_PREDICATE = /^[a-z]*s(?=[A-Z]|$)/u

export function isPascalCase(name) {
  return typeof name === "string" && PASCAL_CASE.test(name)
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

function isVerbPredicate(name) {
  return typeof name === "string" && VERB_PREDICATE.test(name)
}
