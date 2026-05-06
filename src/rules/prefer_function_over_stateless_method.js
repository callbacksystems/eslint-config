// A private method that never touches `this` (or `super`) carries no instance state: it is a plain function hiding in
// the class. Move it to a module-level function so `step-down-top-level` files it among the leaves, and once several
// such functions share the same arguments, `no-data-clump` can surface the object they are really asking for. Scoped to
// private methods on purpose: a public method without `this` can be an intentional interface or polymorphic hook.

import { memberName } from "#helpers/syntax/classes"
import { returnsFixedLiteral } from "#helpers/syntax/literals"
import { MethodContextIndex } from "#helpers/classes/method_context_index"
import { reportProblem } from "#helpers/eslint/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow private methods that never use `this`; make them module-level functions" },
    schema: [],
    messages: { statelessMethod: "Private `{{name}}` never uses `this`; make it a module-level function." }
  },
  create(context) {
    return {
      MethodDefinition: (node) => reportProblem(context,
        new PrivateMethod(node, MethodContextIndex.for(context.sourceCode.ast)))
    }
  }
}

class PrivateMethod {
  #index
  #node

  constructor(node, index) {
    this.#index = index
    this.#node = node
  }

  get problem() {
    return this.#isStateless
      ? { node: this.#node.key, messageId: "statelessMethod", data: { name: memberName(this.#node) } }
      : null
  }

  get #isStateless() {
    return this.#isPrivateMethod && !this.#isConstant && !this.#index.hasInstanceReferenceIn(this.#node.value)
  }

  get #isPrivateMethod() {
    return this.#node.kind === "method" && this.#node.key.type === "PrivateIdentifier"
  }

  // A fixed literal is a constant rather than a function to move out, which `prefer-constant` says better.
  get #isConstant() {
    return returnsFixedLiteral(this.#node.value.body)
  }
}
