// `return`/`throw` is allowed in the leading guard zone (up to 2 boilerplate calls like `event.preventDefault()`, then
// vars and guards) and as the function's last statement. Returns inside loops, switch, or nested functions are
// structured exits and not analyzed here.

import { isFunctionExit, isGuardClause, onFunctions } from "#helpers/functions"
import { reportProblems } from "#helpers/report"

// What each construct holds where an exit would sit mid-function.
const EXIT_HOLDERS = {
  IfStatement: (node) => [ node.consequent, node.alternate ],
  TryStatement: (node) => [ node.block, node.handler?.body, node.finalizer ],
  BlockStatement: (node) => node.body
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow `return`/`throw` outside the leading guard zone or final statement" },
    schema: [
      { type: "object", properties: { maxLeadingCalls: { type: "integer", minimum: 0 } }, additionalProperties: false }
    ],
    defaultOptions: [ { maxLeadingCalls: 2 } ],
    messages: {
      midFunctionReturn: "Avoid mid-function exits. Use a ternary, if/else, find/some/every, or extract a helper."
    }
  },
  create(context) {
    const { maxLeadingCalls } = context.options[0]
    return onFunctions((node) => reportProblems(context, new MidFunctionExits(node, maxLeadingCalls)))
  }
}

class MidFunctionExits {
  #node
  #maxLeadingCalls

  constructor(node, maxLeadingCalls) {
    this.#node = node
    this.#maxLeadingCalls = maxLeadingCalls
  }

  get problems() {
    return this.#offenders.map((offender) => ({ node: offender, messageId: "midFunctionReturn" }))
  }

  get #offenders() {
    return this.#isScannable
      ? this.#bodyStatements.map((statement) => offendingExitIn(statement)).filter(Boolean)
      : []
  }

  get #isScannable() {
    return this.#node.body.type === "BlockStatement" && this.#statements.length >= 2
  }

  get #statements() {
    return this.#node.body.body
  }

  get #bodyStatements() {
    return this.#statements.slice(this.#guardZoneEnd, -1)
  }

  get #guardZoneEnd() {
    const start = this.#skipBoilerplate
    return start + leadingCount(this.#statements.slice(start), isInGuardZone)
  }

  get #skipBoilerplate() {
    return leadingCount(this.#statements.slice(0, this.#maxLeadingCalls), isBoilerplateCall)
  }
}

function offendingExitIn(node) {
  if (node) {
    return isFunctionExit(node) ? node : firstExitIn(EXIT_HOLDERS[node.type]?.(node) ?? [])
  } else {
    return null
  }
}

function firstExitIn(nodes) {
  return nodes.map((child) => offendingExitIn(child)).find(Boolean) ?? null
}

function leadingCount(items, predicate) {
  const breakIndex = items.findIndex((item) => !predicate(item))
  return breakIndex === -1 ? items.length : breakIndex
}

function isInGuardZone(node) {
  return node.type === "VariableDeclaration" || isGuardClause(node)
}

function isBoilerplateCall(node) {
  return node.type === "ExpressionStatement" && node.expression.type === "CallExpression"
}
