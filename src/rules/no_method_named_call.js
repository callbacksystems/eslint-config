// A method or function named `call` is the service-object smell: it names the mechanism (invoke this thing) instead of
// the work. Pick a verb that says what the code does, so call sites read as actions rather than ceremony. Only the
// definition is flagged; invoking some other object's `.call()` is fine.

import { keyName } from "#helpers/classes"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow defining a method or function named `call`" },
    schema: [],
    messages: { methodNamedCall: "`call` is not a name. Give the method a verb that says what it does." }
  },
  create(context) {
    return {
      MethodDefinition(node) {
        if (isNamedCall(node.key)) report(context, node.key)
      },
      FunctionDeclaration(node) {
        if (isNamedCall(node.id)) report(context, node.id)
      }
    }
  }
}

function isNamedCall(key) {
  return keyName(key) === "call"
}

function report(context, key) {
  context.report({ node: key, messageId: "methodNamedCall" })
}
