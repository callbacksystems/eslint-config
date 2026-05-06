// A getter that returns a `querySelector` result names the node it finds: `querySelector` -> an `Element` suffix,
// `querySelectorAll` -> an `Elements` suffix. The convention makes the call site read as the element it yields, and
// keeps the singular/plural distinction visible at every use.

import { calleeMemberName, memberName, staticMemberKeyOf } from "#helpers/syntax/classes"
import { ownReturnArguments } from "#helpers/syntax/functions"
import { reportProblem } from "#helpers/eslint/report"

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
  #cachedKey

  constructor(node) {
    this.#node = node
  }

  get problem() {
    const method = this.#queryMethod
    return method && !this.#name.endsWith(method.suffix)
      ? { node: this.#key.node, messageId: method.messageId, data: { name: this.#name, suffix: method.suffix } }
      : null
  }

  get #queryMethod() {
    return this.#isGetter && this.#hasUniformQueryReturns ? this.#returnMethods[0] : null
  }

  get #isGetter() {
    return this.#node.kind === "get" && Boolean(this.#key)
  }

  get #key() {
    return this.#cachedKey ??= staticMemberKeyOf(this.#node)
  }

  get #hasUniformQueryReturns() {
    return this.#hasQueryReturns && this.#returnMethods.every((method) => method === this.#returnMethods[0])
  }

  get #hasQueryReturns() {
    return this.#returnMethods.length > 0 && this.#returnMethods.every(Boolean)
  }

  get #returnMethods() {
    return ownReturnArguments(this.#node.value).map(queryMethodOf)
  }

  get #name() {
    return memberName(this.#node)
  }
}

function queryMethodOf(node) {
  const expression = node.type === "AssignmentExpression" ? node.right : node
  if (expression.type !== "CallExpression" || expression.callee.type !== "MemberExpression") return null

  const name = calleeMemberName(expression.callee)
  return Object.hasOwn(QUERY_METHODS, name) ? QUERY_METHODS[name] : null
}
