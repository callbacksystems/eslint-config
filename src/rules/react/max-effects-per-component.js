// React `useEffect` should be the exception, not the rule. Components with
// 3+ effects usually have logic that belongs in event handlers, queries, or
// derived state.

import { countMatching } from "#helpers/ast"

const COMPONENT_NAME = /^[A-Z]/u
const DEFAULT_MAX = 2

const componentName = (node) => node.id?.name ?? node.parent?.id?.name

const isComponentLike = (node) => {
  const name = componentName(node)
  return typeof name === "string" && COMPONENT_NAME.test(name)
}

const isUseEffectCall = (node) =>
  node.type === "CallExpression"
  && node.callee.type === "Identifier"
  && node.callee.name === "useEffect"

const tooManyEffectsMessage = "Component has {{count}} `useEffect` calls (max {{max}})."
  + " Move logic to handlers, queries, or derived state."

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit `useEffect` calls per component" },
    schema: [ { type: "object", properties: { max: { type: "integer", minimum: 1 } } } ],
    messages: { tooManyEffects: tooManyEffectsMessage }
  },
  create(context) {
    const max = context.options[0]?.max ?? DEFAULT_MAX

    const check = (node) => {
      if (isComponentLike(node)) {
        const count = countMatching(node.body, isUseEffectCall)
        if (count > max) {
          context.report({ node, messageId: "tooManyEffects", data: { count, max } })
        }
      }
    }

    return { FunctionDeclaration: check, FunctionExpression: check, ArrowFunctionExpression: check }
  }
}
