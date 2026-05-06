// Curated rather than lexical: noun-verbs that name a value fine (`count`, `name`, `order`) and command verbs that act
// rather than produce (`save`, `render`, `send`) are left out on purpose.

const PRODUCER_VERBS = new Set([
  "get", "fetch", "retrieve", "obtain", "acquire", "load",
  "compute", "calculate", "derive", "determine", "evaluate", "deduce", "infer",
  "generate", "produce", "fabricate", "assemble", "construct", "build", "make", "create",
  "convert", "transform", "translate", "cast", "coerce",
  "serialize", "deserialize", "stringify", "normalize", "denormalize", "parse", "extract",
  "format", "summarize", "aggregate", "tabulate",
  "find", "lookup", "locate", "search", "select", "pick", "choose",
  "collect", "gather", "accumulate", "compile",
  "resolve"
])

export function isProducerVerb(word) {
  return PRODUCER_VERBS.has(word)
}
