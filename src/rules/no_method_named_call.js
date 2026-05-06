// A method or function named `call` is the service-object smell: it names the mechanism (invoke this thing) instead of
// the work. Pick a verb that says what the code does, so call sites read as actions rather than ceremony. Only the
// definition is flagged; invoking some other object's `.call()` is fine.

import { isFunction } from "#helpers/syntax/functions"
import { staticMemberKeyOf } from "#helpers/syntax/classes"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow defining a method or function named `call`" },
    schema: [],
    messages: { methodNamedCall: "`call` is not a name. Give the method a verb that says what it does." }
  },
  create(context) {
    const definitions = new Definitions(context)
    return {
      MethodDefinition: (node) => definitions.member(node),
      FunctionDeclaration: (node) => definitions.declaration(node),
      PropertyDefinition: (node) => definitions.functionMember(node),
      VariableDeclarator: (node) => definitions.functionVariable(node)
    }
  }
}

class Definitions {
  #context

  constructor(context) {
    this.#context = context
  }

  declaration(node) {
    if (node.id?.name === "call") this.#report(node.id)
  }

  functionMember(node) {
    if (isFunction(node.value)) this.member(node)
  }

  member(node) {
    const key = staticMemberKeyOf(node)
    if (key?.name === "call") this.#report(key.node)
  }

  functionVariable(node) {
    if (isFunction(node.init) && isCallIdentifier(node.id)) this.#report(node.id)
  }

  #report(key) {
    this.#context.report({ node: key, messageId: "methodNamedCall" })
  }
}

function isCallIdentifier(node) {
  return node.type === "Identifier" && node.name === "call"
}
