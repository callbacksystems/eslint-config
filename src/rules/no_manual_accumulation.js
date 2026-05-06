// `let acc = []; for (...) acc.push(...)` and `const acc = []; items.forEach((x) => acc.push(...))` and similar
// manual-build patterns should be expressed declaratively with map/filter/Object.fromEntries or new Map. The
// declaration may sit anywhere earlier in the same statement list, and the mutation may sit under `if`/`else` or
// `switch` branches, as long as every statement the body reaches is that mutation. Skipped when the body has any other
// statement, or a break/continue/return/throw leaving the loop, where the declarative form would lose behavior.

import { Accumulation } from "#helpers/arrays/accumulation"
import { onTypes } from "#helpers/syntax/ast"

const STATEMENT_TYPES = new Set([ "ForOfStatement", "ForInStatement", "ForStatement", "ExpressionStatement" ])
const SUGGESTIONS = {
  array: "`map`/`filter`/`flatMap`",
  object: "`Object.fromEntries(items.map(...))`",
  map: "`new Map(items.map(...))`"
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer declarative array/object/Map building over manual loop or forEach accumulation" },
    schema: [],
    messages: { manualAccumulation: "Replace this manual accumulation with {{suggestion}}." }
  },
  create(context) {
    return onTypes(STATEMENT_TYPES, (node) => reportAccumulation(context, node))
  }
}

function reportAccumulation(context, node) {
  const { kind } = new Accumulation(node, context.sourceCode)
  if (kind) context.report({ node, messageId: "manualAccumulation", data: { suggestion: SUGGESTIONS[kind] } })
}
