// A private method that assigns many instance fields is doing too much: each `this.#x = ...` is a responsibility. Split
// it into focused methods. Memoization (`this.#x ??= ...`) is not a plain assignment and does not count. The
// constructor and public methods (which legitimately wire up state) are exempt.

import { memberName } from "#helpers/syntax/classes"
import { MethodContextIndex } from "#helpers/classes/method_context_index"
import { reportProblem } from "#helpers/eslint/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Limit plain instance-field assignments in a private method" },
    schema: [ { type: "object", properties: { max: { type: "integer", minimum: 1 } }, additionalProperties: false } ],
    defaultOptions: [ { max: 2 } ],
    messages: {
      tooManyAssignments: "`{{name}}` has {{count}} field assignments (max {{max}}). Split into separate methods."
    }
  },
  create(context) {
    const { max } = context.options[0]
    return {
      MethodDefinition: (node) => reportProblem(context, new FieldAssignments(node, {
        index: MethodContextIndex.for(context.sourceCode.ast), max
      }))
    }
  }
}

class FieldAssignments {
  #index
  #node
  #max

  constructor(node, { index, max }) {
    this.#index = index
    this.#node = node
    this.#max = max
  }

  get problem() {
    return this.#isOffense
      ? { node: this.#node.key, messageId: "tooManyAssignments", data: this.#data }
      : null
  }

  get #isOffense() {
    return this.#isCheckable && this.#count > this.#max
  }

  get #isCheckable() {
    return this.#node.kind !== "constructor" && this.#node.key.type === "PrivateIdentifier"
  }

  get #count() {
    return this.#index.fieldAssignmentCountIn(this.#node.value)
  }

  get #data() {
    return { name: memberName(this.#node), count: this.#count, max: this.#max }
  }
}
