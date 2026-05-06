// A class field declared without a value declares nothing: whatever assigns it creates the property anyway. Private
// fields are the exception the language itself makes, since `this.#x` is a syntax error without its declaration, and a
// decorated field needs one for the decorator to have something to decorate.

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
    return !this.#node.value && this.#isPlainPublic
  }

  get #isPlainPublic() {
    return this.#node.key.type !== "PrivateIdentifier" && !this.#node.decorators?.length
  }

  get #name() {
    return this.#sourceCode.getText(this.#node.key)
  }

  // Removing forward leaves the member below on the indentation the field left behind. A comment written under the
  // field belongs to what follows it, so the removal stops short of it.
  get #fix() {
    return (fixer) => fixer.removeRange(rangeEndingAtFirstComment(this.#sourceCode, this.#range))
  }

  get #range() {
    return [ this.#node.range[0], this.#sourceCode.getTokenAfter(this.#node).range[0] ]
  }
}
