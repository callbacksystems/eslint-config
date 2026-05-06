// The producer verbs flagged by `declarative-method-naming`: verbs that name handing a value back, where the method
// should be named for that value instead. The list is curated rather than lexical, so it leaves out noun-verbs that
// name a value fine (`count`, `name`, `value`, `order`, `state`, `index`, `total`) and command verbs that act rather
// than produce (`save`, `render`, `update`, `send`, `handle`, `process`).

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
