// A function whose whole body returns a fixed literal is a constant written as a function: it takes nothing, computes
// nothing, and hands back the same value every call. Name it as a constant instead.
//
// Exported functions and public methods are API and are left alone, and so is anything whose literal reads a binding or
// calls something, since that is a value being built rather than one being stated. There is no fix: turning a composed
// literal into a constant makes every caller share one object, which is the point when it is only read and a bug when
// someone mutates it, and only a person can tell those apart.

import { FunctionSubject } from "#helpers/functions/function_subject"
import { returnsFixedLiteral } from "#helpers/syntax/literals"
import { MethodSubject } from "#helpers/classes/method_subject"
import { ModuleView } from "#helpers/flow/module_view"
import { reportProblem } from "#helpers/eslint/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow functions whose body only returns a fixed literal; name them as constants" },
    schema: [],
    messages: { preferConstant: "`{{name}}` always returns the same literal. Declare it as a constant instead." }
  },
  create(context) {
    const view = new ModuleView(context.sourceCode)
    return {
      FunctionDeclaration: (node) => reportProblem(context, new ConstantFunction(new FunctionSubject(node, view))),
      MethodDefinition: (node) => reportProblem(context, new ConstantFunction(new ConstantMethodSubject(node)))
    }
  }
}

class ConstantFunction {
  #subject

  constructor(subject) {
    this.#subject = subject
  }

  get problem() {
    return this.#isConstant
      ? { node: this.#subject.nameNode, messageId: "preferConstant", data: { name: this.#subject.name } }
      : null
  }

  get #isConstant() {
    return this.#subject.isEligible && returnsFixedLiteral(this.#subject.body)
  }
}

class ConstantMethodSubject extends MethodSubject {
  // A public method can be the extension point a subclass overrides, which no single file can rule out.
  get isEligible() {
    return this.isPrivate && !this.isAsync && !this.isGenerator
  }
}
