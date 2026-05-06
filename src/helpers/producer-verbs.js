// The producer verbs flagged by `declarative-method-naming`: verbs that name
// handing a value back, where the method should be named for that value instead.
// Curated, not lexical: `get`/`find`/`build` are dropped from no dictionary, but
// are bad as method prefixes by code convention. Excluded on purpose:
// noun-verbs that name a value fine (`count`, `name`, `value`, `order`, `state`,
// `index`, `total`, `size`...) and command verbs that act rather than produce
// (`save`, `render`, `update`, `send`, `handle`, `process`...).

export default [
  "get", "fetch", "retrieve", "obtain", "acquire", "load",
  "compute", "calculate", "derive", "determine", "evaluate", "deduce", "infer",
  "generate", "produce", "fabricate", "assemble", "construct", "build", "make", "create",
  "convert", "transform", "translate", "cast", "coerce",
  "serialize", "deserialize", "stringify", "normalize", "denormalize", "parse", "extract",
  "format", "summarize", "aggregate", "tabulate",
  "find", "lookup", "locate", "search", "select", "pick", "choose",
  "collect", "gather", "accumulate", "compile",
  "resolve"
]
