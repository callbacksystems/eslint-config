// Stimulus generates `hasFooTarget` for every declared target. Comparing `this.fooTargets.length` to 0 or 1 reinvents
// the getter and reads worse. The rule fires only on those comparisons; using `.length` for counts or iteration is a
// different intent.

import { enclosingStimulusController } from "#helpers/stimulus"
import { capitalize } from "#helpers/naming"
import { reportProblem } from "#helpers/report"

const TARGETS_PROPERTY = /^([a-z][a-zA-Z0-9]*)Targets$/u
const EXISTENCE_LITERALS = new Set([ 0, 1 ])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer the `hasFooTarget` getter over comparing `this.fooTargets.length`" },
    schema: [],
    messages: { useHasTarget: "Use `this.has{{Name}}Target` instead of comparing `this.{{name}}Targets.length`." }
  },
  create(context) {
    return { MemberExpression: (node) => reportProblem(context, new TargetLengthAccess(node)) }
  }
}

class TargetLengthAccess {
  #node

  constructor(node) {
    this.#node = node
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
    return Boolean(this.#targetName) && this.#isInExistenceCheck && enclosingStimulusController(this.#node)
  }

  get #targetName() {
    return this.#isThisTargetsLength
      ? this.#node.object.property.name.match(TARGETS_PROPERTY)?.[1] ?? null
      : null
  }

  get #isThisTargetsLength() {
    return isLengthAccess(this.#node) && isThisTargetsObject(this.#node.object)
  }

  get #isInExistenceCheck() {
    const { parent } = this.#node
    if (parent?.type !== "BinaryExpression") return false

    const other = parent.left === this.#node ? parent.right : parent.left
    return other.type === "Literal" && EXISTENCE_LITERALS.has(other.value)
  }
}

function isLengthAccess(node) {
  return node.type === "MemberExpression"
    && !node.computed
    && node.property.type === "Identifier"
    && node.property.name === "length"
}

function isThisTargetsObject(object) {
  return object.type === "MemberExpression"
    && !object.computed
    && object.object.type === "ThisExpression"
    && object.property.type === "Identifier"
}
