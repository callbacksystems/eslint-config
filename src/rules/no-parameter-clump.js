// Wrapping the parameters as `{ a, b, c }` only renames the problem; extract
// a class so the parameters become instance state. ObjectPattern keys count
// as parameters, so destructuring doesn't bypass the rule. Restricted to
// classes; top-level helpers that share a signature are usually pure analogs.

const REQUIRED_METHODS = 3
const REQUIRED_PAIR_SIZE = 2

const objectPatternKeys = (pattern) =>
  pattern.properties
    .filter((property) => property.type === "Property" && property.key.type === "Identifier")
    .map((property) => property.key.name)

const extractParameterNames = (parameter) => {
  if (parameter.type === "Identifier") return [ parameter.name ]
  if (parameter.type === "ObjectPattern") return objectPatternKeys(parameter)
  if (parameter.type === "AssignmentPattern") return extractParameterNames(parameter.left)
  return []
}

// Single-letter parameters (x, y, i, j, etc.) are typically coordinates or
// indices, not data clumps worth encapsulating.
const isMeaningfulName = (name) => name.length > 1

const parameterNamesOf = (method) =>
  method.params.flatMap((parameter) => extractParameterNames(parameter)).filter(isMeaningfulName)

const allParameterPairs = (parameterNames) => {
  const sorted = [ ...parameterNames ].sort()
  return sorted.flatMap((a, index) => sorted.slice(index + 1).map((b) => `${a}|${b}`))
}

const buildPairCounts = (methods) =>
  methods
    .flatMap((method) => allParameterPairs(parameterNamesOf(method)))
    .reduce((counts, pair) => counts.set(pair, (counts.get(pair) ?? 0) + 1), new Map())

const findClump = (methods) => {
  const counts = buildPairCounts(methods)
  const matched = [ ...counts.entries() ].find(([ , count ]) => count >= REQUIRED_METHODS)
  if (!matched) return null

  const parameters = matched[0].split("|")
  const affected = methods.filter((method) =>
    parameters.every((name) => parameterNamesOf(method).includes(name))
  )
  return { parameters, affected }
}

const isFunctionLike = (value) =>
  Boolean(value) && (value.type === "FunctionExpression" || value.type === "ArrowFunctionExpression")

const isAnalysisCandidate = (member) =>
  member.type === "MethodDefinition" && member.kind !== "constructor" && isFunctionLike(member.value)

const collectFromClass = (classBody) =>
  classBody.body.filter((member) => isAnalysisCandidate(member)).map((member) => member.value)

const checkClass = (context, methods) => {
  if (methods.length < REQUIRED_METHODS) return

  const clump = findClump(methods)
  if (!clump || clump.parameters.length < REQUIRED_PAIR_SIZE) return

  context.report({
    node: clump.affected[0],
    messageId: "parameterClump",
    data: { count: clump.affected.length, parameters: clump.parameters.join(", ") }
  })
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Detect class methods that share parameters, suggesting a parameter object or constructor data"
    },
    schema: [],
    messages: {
      parameterClump: "{{count}} methods share [{{parameters}}]. Extract a class so these become instance state."
    }
  },
  create(context) {
    return {
      ClassBody: (node) => checkClass(context, collectFromClass(node))
    }
  }
}
