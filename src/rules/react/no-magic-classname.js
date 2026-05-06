// String of utility classes (e.g. Tailwind) repeated 3+ times in a file
// signals duplication. Extract to a constant or component.

import { walkAst } from "#helpers/ast"

const MIN_TOKENS = 3
const MIN_OCCURRENCES = 3
const TRUNCATE_AT = 40

const tokensOf = (value) => value.trim().split(/\s+/u).filter(Boolean)

const looksLikeClassList = (value) => {
  const tokens = tokensOf(value)
  return tokens.length >= MIN_TOKENS && tokens.every((token) => /^[a-z][a-z0-9:_/-]*$/u.test(token))
}

const stringValueOf = (node) => {
  if (node.type === "Literal" && typeof node.value === "string") return node.value
  if (node.type === "TemplateElement") return node.value.cooked
  return null
}

const tallyClassnameStrings = (programNode) => {
  const counts = new Map()
  walkAst(programNode, (node) => {
    const value = stringValueOf(node)
    if (!value || !looksLikeClassList(value)) return

    const entry = counts.get(value) ?? { count: 0, firstNode: node }
    entry.count += 1
    counts.set(value, entry)
  })
  return counts
}

const truncate = (value) => value.length > TRUNCATE_AT ? `${value.slice(0, TRUNCATE_AT)}...` : value

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow utility-class strings duplicated across a file" },
    schema: [],
    messages: {
      magicClassname: "Utility-class string `{{value}}` appears {{count}} times. Extract to a constant or component."
    }
  },
  create(context) {
    return {
      Program(node) {
        for (const [ value, { count, firstNode } ] of tallyClassnameStrings(node)) {
          if (count >= MIN_OCCURRENCES) {
            context.report({ node: firstNode, messageId: "magicClassname", data: { value: truncate(value), count } })
          }
        }
      }
    }
  }
}
