// Stimulus generates `hasFooTarget` for every declared target. Comparing `this.fooTargets.length` to 0 or 1 reinvents
// the getter and reads worse. The rule fires only on those comparisons; using `.length` for counts or iteration is a
// different intent.

import { resolvedPublicMemberNameOf } from "#helpers/classes/resolved_member_key"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { enclosingStimulusController, isControllerInstanceThis } from "#helpers/classes/stimulus"
import { capitalize } from "#helpers/strings/naming"
import { reportProblem } from "#helpers/eslint/report"

const TARGETS_PROPERTY = /^([a-z][a-zA-Z0-9]*)Targets$/u
const EXISTENCE_COMPARISONS = new Set([ "!==:0", "!=:0", ">:0", ">=:1", "===:0", "==:0", "<:1", "<=:0" ])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer the `hasFooTarget` getter over comparing `this.fooTargets.length`" },
    schema: [],
    messages: { useHasTarget: "Use `this.has{{Name}}Target` instead of comparing `this.{{name}}Targets.length`." }
  },
  create(context) {
    const bindings = BindingResolver.for(context.sourceCode)
    return { MemberExpression: (node) => reportProblem(context, new TargetLengthAccess(node, bindings)) }
  }
}

class TargetLengthAccess {
  #node
  #bindings

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
  }

  get problem() {
    if (this.#isReportable) {
      return {
        node: this.#node,
        messageId: "useHasTarget",
        data: { name: this.#targetName, Name: capitalize(this.#targetName) }
      }
    } else {
      return null
    }
  }

  get #isReportable() {
    return Boolean(this.#targetName)
      && this.#existenceComparison.isPresent
      && isControllerInstanceThis(this.#node.object.object, enclosingStimulusController(this.#node))
  }

  get #targetName() {
    return this.#isThisTargetsLength
      ? resolvedPublicMemberNameOf(this.#node.object, this.#bindings)?.match(TARGETS_PROPERTY)?.[1] ?? null
      : null
  }

  get #isThisTargetsLength() {
    return isLengthAccess(this.#node, this.#bindings) && isThisTargetsObject(this.#node.object)
  }

  get #existenceComparison() {
    return new ExistenceComparison(this.#node)
  }
}

function isLengthAccess(node, bindings) {
  return node.type === "MemberExpression"
    && resolvedPublicMemberNameOf(node, bindings) === "length"
}

function isThisTargetsObject(object) {
  return object.type === "MemberExpression"
    && object.object.type === "ThisExpression"
}

class ExistenceComparison {
  #node

  constructor(node) {
    this.#node = node
  }

  get isPresent() {
    return this.#isBinary && this.#isSupported
  }

  get #isBinary() {
    return this.#comparison?.type === "BinaryExpression"
  }

  get #comparison() {
    return this.#node.parent
  }

  get #isSupported() {
    return this.#hasExistenceLiteral && EXISTENCE_COMPARISONS.has(`${this.#operator}:${this.#other.value}`)
  }

  get #hasExistenceLiteral() {
    return this.#other.type === "Literal" && [ 0, 1 ].includes(this.#other.value)
  }

  get #other() {
    return this.#comparison.left === this.#node ? this.#comparison.right : this.#comparison.left
  }

  get #operator() {
    return this.#comparison.left === this.#node ? this.#comparison.operator : reversed(this.#comparison.operator)
  }
}

function reversed(operator) {
  return { "<": ">", "<=": ">=", ">": "<", ">=": "<=" }[operator] ?? operator
}
