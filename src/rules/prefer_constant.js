// A function whose whole body returns a fixed literal is a constant written as a function: it takes nothing, computes
// nothing, and hands back the same value every call. Name it as a constant instead.
//
// Exported functions and public methods are API and are left alone, and so is anything whose literal reads a binding or
// calls something, since that is a value being built rather than one being stated. There is no fix: turning a composed
// literal into a constant makes every caller share one object, which is the point when it is only read and a bug when
// someone mutates it, and only a person can tell those apart.

import { memberName } from "#helpers/classes"
import { returnsFixedLiteral } from "#helpers/literals"
import { reportProblem } from "#helpers/report"

const EXPORT_TYPES = new Set([ "ExportNamedDeclaration", "ExportDefaultDeclaration" ])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow functions whose body only returns a fixed literal; name them as constants" },
    schema: [],
    messages: { preferConstant: "`{{name}}` always returns the same literal. Declare it as a constant instead." }
  },
  create(context) {
    return {
      FunctionDeclaration: (node) => reportProblem(context, new ConstantFunction(new FunctionSubject(node))),
      MethodDefinition: (node) => reportProblem(context, new ConstantFunction(new MethodSubject(node)))
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

class FunctionSubject {
  #node

  constructor(node) {
    this.#node = node
  }

  get nameNode() {
    return this.#node.id
  }

  get name() {
    return this.#node.id.name
  }

  get body() {
    return this.#node.body
  }

  get isEligible() {
    return !EXPORT_TYPES.has(this.#node.parent?.type)
  }
}

class MethodSubject {
  #node

  constructor(node) {
    this.#node = node
  }

  get nameNode() {
    return this.#node.key
  }

  get name() {
    return memberName(this.#node)
  }

  get body() {
    return this.#node.value.body
  }

  // A public method can be the extension point a subclass overrides, which no single file can rule out.
  get isEligible() {
    return this.#node.key.type === "PrivateIdentifier"
  }
}
