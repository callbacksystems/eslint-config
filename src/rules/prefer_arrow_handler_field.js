// `this.foo = this.foo.bind(this)` inside any method (constructor, Stimulus `initialize`/`connect`, etc.) binds
// imperatively. Prefer an arrow class field `foo = () => { ... }` for auto-binding; cleaner, symmetric with
// `removeEventListener`, no manual rebinding needed.

import { ClassThisBindings } from "#helpers/classes/class_this_bindings"
import { boundThisMemberKeyOf, thisMemberKeyOf } from "#helpers/syntax/classes"
import { isIdentifierName } from "#helpers/strings/naming"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer arrow class fields over `this.foo = this.foo.bind(this)`" },
    schema: [],
    messages: { preferArrowField: "Use an arrow class field `{{name}} = () => {...}` instead of `.bind(this)`." }
  },
  create(context) {
    const bindings = new ClassThisBindings(context.sourceCode.ast)
    return { AssignmentExpression: (node) => reportThisBindAssignment(context, node, bindings) }
  }
}

function reportThisBindAssignment(context, assignment, bindings) {
  const { problem } = new ThisBindAssignment(assignment, bindings, context.sourceCode)
  if (problem) context.report(problem)
}

class ThisBindAssignment {
  #node
  #bindings
  #sourceCode
  #cachedAssignedKey
  #cachedMethodFunction

  constructor(node, bindings, sourceCode) {
    this.#node = node
    this.#bindings = bindings
    this.#sourceCode = sourceCode
  }

  get problem() {
    return this.#isOffense
      ? { node: this.#node, messageId: "preferArrowField", data: { name: this.#fieldSyntax } }
      : null
  }

  get #isOffense() {
    return this.#node.operator === "=" && this.#hasMatchingMembers && Boolean(this.#methodFunction)
  }

  get #hasMatchingMembers() {
    const boundKey = boundThisMemberKeyOf(this.#node.right)
    return Boolean(this.#assignedKey) && Boolean(boundKey)
      && this.#assignedKey.name === boundKey.name
      && isPrivate(this.#assignedKey) === isPrivate(boundKey)
  }

  get #assignedKey() {
    return this.#cachedAssignedKey ??= thisMemberKeyOf(this.#node.left)
  }

  get #methodFunction() {
    return this.#cachedMethodFunction ??= this.#assignedKey
      ? this.#bindings.methodFunctionOf(this.#node.left.object)
      : null
  }

  get #fieldSyntax() {
    return `${this.#methodFunction.parent.static ? "static " : ""}${this.#fieldName}`
  }

  get #fieldName() {
    if (isPrivate(this.#assignedKey)) return `#${this.#assignedKey.name}`
    if (this.#canUseBareFieldName) return this.#assignedKey.name
    return `[${this.#computedFieldSource}]`
  }

  get #canUseBareFieldName() {
    return isIdentifierName(this.#assignedKey.name)
      && this.#assignedKey.name !== "constructor"
      && (!this.#methodFunction.parent.static || this.#assignedKey.name !== "prototype")
  }

  get #computedFieldSource() {
    return this.#assignedKey.node.type === "Identifier"
      ? JSON.stringify(this.#assignedKey.name)
      : this.#sourceCode.getText(this.#assignedKey.node)
  }
}

function isPrivate(key) {
  return key.node.type === "PrivateIdentifier"
}
