// An uninitialized public class field is usually accidental state: initialize it where its invariant is established or
// omit it deliberately. It still creates an own enumerable property, so the rule reports without autofixing.

import { reportProblem } from "#helpers/eslint/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow a class field declared without a value" },
    schema: [],
    messages: { uninitializedField: "Initialize `{{name}}`, or omit its declaration deliberately." }
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
      ? { node: this.#node, messageId: "uninitializedField", data: { name: this.#name } }
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
}
