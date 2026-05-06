// A getter that returns a `querySelector` result names the node it finds:
// `querySelector` -> an `Element` suffix, `querySelectorAll` -> an `Elements`
// suffix. The convention makes the call site read as the element it yields, and
// keeps the singular/plural distinction visible at every use.

import { ownReturnArguments, propertyNameOf } from "#helpers/ast"
import { reportProblem } from "#helpers/report"

const QUERY_METHODS = {
  querySelector: { suffix: "Element", messageId: "singularSuffix" },
  querySelectorAll: { suffix: "Elements", messageId: "pluralSuffix" }
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Require getters returning querySelector(All) results to end in Element/Elements" },
    schema: [],
    messages: {
      singularSuffix: "Getter `{{name}}` returns a `querySelector` element; name it to end in `{{suffix}}`.",
      pluralSuffix: "Getter `{{name}}` returns `querySelectorAll` elements; name it to end in `{{suffix}}`."
    }
  },
  create(context) {
    return { MethodDefinition: (node) => reportProblem(context, new QueryingGetter(node)) }
  }
}

class QueryingGetter {
  #node

  constructor(node) {
    this.#node = node
  }

  get problem() {
    const method = this.#queryMethod
    return method && !this.#name.endsWith(method.suffix)
      ? { node: this.#node.key, messageId: method.messageId, data: { name: this.#name, suffix: method.suffix } }
      : null
  }

  get #queryMethod() {
    return this.#isGetter ? this.#returnedQueryMethods[0] ?? null : null
  }

  get #isGetter() {
    return this.#node.kind === "get" && this.#node.key.type === "Identifier"
  }

  get #returnedQueryMethods() {
    return ownReturnArguments(this.#node.value).map(queryMethodOf).filter(Boolean)
  }

  get #name() {
    return this.#node.key.name
  }
}

function queryMethodOf(node) {
  const expression = node.type === "AssignmentExpression" ? node.right : node
  return expression.type === "CallExpression" && expression.callee.type === "MemberExpression"
    ? QUERY_METHODS[propertyNameOf(expression.callee)] ?? null
    : null
}
