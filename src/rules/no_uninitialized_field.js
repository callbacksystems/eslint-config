// A class field declared without a value declares nothing: whatever assigns it creates the property anyway. Private
// fields are the exception the language itself makes, since `this.#x` is a syntax error without its declaration.

import { rangeEndingAtFirstComment } from "#helpers/source"
import { reportProblem } from "#helpers/report"

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Disallow a class field declared without a value" },
    schema: [],
    messages: { uninitializedField: "`{{name}}` declares a field without a value. Drop the declaration." }
  },
  create(context) {
    return { PropertyDefinition: (node) => reportProblem(context, new Field(node, context.sourceCode)) }
  }
}

class Field {
  #node
  #sourceCode

  constructor(node, sourceCode) {
    this.#node = node
    this.#sourceCode = sourceCode
  }

  get problem() {
    return this.#isNeedless
      ? { node: this.#node, messageId: "uninitializedField", data: { name: this.#name }, fix: this.#fix }
      : null
  }

  get #isNeedless() {
    return !this.#node.value && this.#isPublic
  }

  get #isPublic() {
    return this.#node.key.type !== "PrivateIdentifier"
  }

  get #name() {
    return this.#sourceCode.getText(this.#node.key)
  }

  // Removing forward to the next token leaves the member below on the field's indentation, and stops short of a comment
  // under the field, which belongs to what follows it.
  get #fix() {
    return (fixer) => fixer.removeRange(rangeEndingAtFirstComment(this.#sourceCode, this.#range))
  }

  get #range() {
    return [ this.#node.range[0], this.#sourceCode.getTokenAfter(this.#node).range[0] ]
  }
}
